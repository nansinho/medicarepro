"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import {
  discardDrafts,
  publishPage,
  saveSectionDraft,
  type PageActionResult,
} from "@/app/admin/(protected)/pages/actions";
import SectionForm from "@/components/admin/forms/SectionForm";
import type { SectionType } from "@/lib/cms/sections.schema";
import { Notice } from "@/components/admin/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/* ============================================================
   Éditeur d'une page gérée : liste des sections en cartes
   (ordre du fallback, fixe) ; l'édition d'une section ouvre un
   panneau latéral (Sheet). Autosave débouncé (1,2 s) vers
   page_sections.draft ; publication explicite au niveau page.
   ============================================================ */

export type EditorSlot = {
  key: string;
  type: SectionType;
  label: string;
  description: string;
  published: Record<string, unknown>;
  draft: Record<string, unknown> | null;
  updatedAt: string | null;
};

type SlotState = {
  value: Record<string, unknown>;
  dirty: boolean;
  hasDraft: boolean;
  baseUpdatedAt: string | null;
  saving: boolean;
};

export default function PageEditor({
  slug,
  slots,
}: {
  slug: string;
  slots: EditorSlot[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  /* Section ouverte dans le panneau d'édition ("" = panneau fermé). */
  const [selected, setSelected] = useState("");
  const [notice, setNotice] = useState<PageActionResult | null>(null);
  const [states, setStates] = useState<Record<string, SlotState>>(() =>
    Object.fromEntries(
      slots.map((slot) => [
        slot.key,
        {
          value: slot.draft ?? slot.published,
          dirty: false,
          hasDraft: slot.draft != null,
          baseUpdatedAt: slot.updatedAt,
          saving: false,
        },
      ]),
    ),
  );
  const timers = useRef<Record<string, number>>({});

  const current = slots.find((slot) => slot.key === selected);
  const currentState = current ? states[current.key] : undefined;

  function scheduleSave(key: string) {
    window.clearTimeout(timers.current[key]);
    timers.current[key] = window.setTimeout(() => flushSave(key), 1200);
  }

  function flushSave(key: string) {
    setStates((prev) => {
      const state = prev[key];
      if (!state || !state.dirty || state.saving) return prev;
      const slot = slots.find((s) => s.key === key);
      if (!slot) return prev;

      const formData = new FormData();
      formData.set("slug", slug);
      formData.set("sectionKey", key);
      formData.set("baseUpdatedAt", state.baseUpdatedAt ?? "");
      formData.set(
        "content",
        JSON.stringify({ ...state.value, type: slot.type }),
      );

      saveSectionDraft(formData).then((result) => {
        setStates((inner) => ({
          ...inner,
          [key]: {
            ...inner[key],
            saving: false,
            dirty: result.ok ? false : inner[key].dirty,
            hasDraft: result.ok ? true : inner[key].hasDraft,
            baseUpdatedAt: result.ok
              ? (result.updatedAt ?? inner[key].baseUpdatedAt)
              : inner[key].baseUpdatedAt,
          },
        }));
        if (!result.ok) setNotice(result);
      });

      return { ...prev, [key]: { ...state, saving: true } };
    });
  }

  /* Flush au démontage / fermeture (best-effort). */
  useEffect(() => {
    const handler = () => {
      for (const key of Object.keys(timers.current)) flushSave(key);
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- flushSave stable par construction
  }, []);

  function handleChange(key: string, value: Record<string, unknown>) {
    setStates((prev) => ({
      ...prev,
      [key]: { ...prev[key], value, dirty: true },
    }));
    scheduleSave(key);
  }

  function handlePublish() {
    /* Pousser d'abord les modifications en attente. */
    for (const key of Object.keys(states)) flushSave(key);
    const formData = new FormData();
    formData.set("slug", slug);
    startTransition(async () => {
      /* Petite marge pour laisser partir les autosaves. */
      await new Promise((r) => setTimeout(r, 600));
      const result = await publishPage(formData);
      setNotice(result);
      if (result.ok) router.refresh();
    });
  }

  function handleDiscard() {
    if (!window.confirm("Abandonner tous les brouillons de cette page ?")) return;
    const formData = new FormData();
    formData.set("slug", slug);
    startTransition(async () => {
      const result = await discardDrafts(formData);
      setNotice(result);
      if (result.ok) window.location.reload();
    });
  }

  const draftCount = Object.values(states).filter(
    (state) => state.hasDraft || state.dirty,
  ).length;
  const savingAny = Object.values(states).some((state) => state.saving);

  return (
    <div className="flex flex-col gap-4">
      {notice && !notice.ok && (
        <Notice tone="bad" title="Erreur">
          {notice.message}
        </Notice>
      )}
      {notice?.ok && notice.message && (
        <Notice tone="ok" title="Modifications enregistrées">
          {notice.message}
        </Notice>
      )}

      {/* Barre d'état + actions globales de la page */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-muted-foreground" role="status">
            {savingAny
              ? "Enregistrement…"
              : draftCount > 0
                ? `${draftCount} section(s) en brouillon`
                : "Tout est publié"}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <a
                href={`/api/draft/enable?path=${encodeURIComponent(slug)}`}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink />
                Aperçu du brouillon
              </a>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-bad hover:bg-bad/10 hover:text-bad"
              disabled={pending || draftCount === 0}
              onClick={handleDiscard}
            >
              Abandonner les brouillons
            </Button>
            <Button
              disabled={pending || draftCount === 0}
              onClick={handlePublish}
            >
              {pending ? "Publication…" : "Publier les modifications"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sections de la page */}
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3 @wide/page:grid-cols-4 @ultra/page:grid-cols-5">
        {slots.map((slot) => {
          const state = states[slot.key];
          const hasDraft = Boolean(state?.hasDraft || state?.dirty);
          return (
            <Card key={slot.key}>
              <CardContent className="flex h-full items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-semibold text-foreground">
                      {slot.label}
                    </span>
                    <Badge variant={hasDraft ? "amber" : "green"}>
                      {hasDraft ? "Brouillon" : "Publié"}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {slot.description}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-none"
                  onClick={() => setSelected(slot.key)}
                >
                  Modifier
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Panneau d'édition d'une section (latéral, pas de modal centré) */}
      <Sheet open={!!current} onOpenChange={(open) => !open && setSelected("")}>
        <SheetContent className="flex w-full flex-col gap-0 sm:max-w-2xl">
          {current && currentState && (
            <>
              <SheetHeader>
                <SheetTitle>{current.label}</SheetTitle>
                {current.description && (
                  <SheetDescription>{current.description}</SheetDescription>
                )}
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-4 py-4">
                <SectionForm
                  key={current.key}
                  type={current.type}
                  value={currentState.value}
                  onChange={(next) => handleChange(current.key, next)}
                />
              </div>

              <SheetFooter className="flex-row items-center justify-between gap-2 border-t">
                <span className="text-xs text-muted-foreground" role="status">
                  {currentState.saving
                    ? "Enregistrement…"
                    : currentState.hasDraft || currentState.dirty
                      ? "Brouillon non publié"
                      : "Publié"}
                </span>
                <SheetClose asChild>
                  <Button variant="secondary">Fermer</Button>
                </SheetClose>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
