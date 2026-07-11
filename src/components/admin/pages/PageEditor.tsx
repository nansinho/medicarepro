"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  discardDrafts,
  publishPage,
  saveSectionDraft,
  type PageActionResult,
} from "@/app/admin/(protected)/pages/actions";
import SectionForm from "@/components/admin/forms/SectionForm";
import type { SectionType } from "@/lib/cms/sections.schema";
import pe from "./pageEditor.module.css";

/* ============================================================
   Éditeur d'une page gérée : slots à gauche (ordre du fallback,
   fixes), formulaire de la section à droite. Autosave débouncé
   (1,2 s) vers page_sections.draft ; publication explicite.
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
  const [selected, setSelected] = useState(slots[0]?.key ?? "");
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
    <div className={pe.layout}>
      <aside className={pe.slotCol}>
        <nav className={pe.slotList} aria-label="Sections de la page">
          {slots.map((slot) => {
            const state = states[slot.key];
            return (
              <button
                key={slot.key}
                type="button"
                className={`${pe.slotBtn} ${selected === slot.key ? pe.slotActive : ""}`}
                onClick={() => setSelected(slot.key)}
              >
                <span className={pe.slotLabel}>
                  <b>{slot.label}</b>
                  <small>{slot.description}</small>
                </span>
                {(state?.hasDraft || state?.dirty) && (
                  <span
                    className={pe.slotDot}
                    title="Modifications non publiées"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className={pe.actions}>
          <p className={pe.saveState} role="status">
            {savingAny
              ? "Enregistrement…"
              : draftCount > 0
                ? `${draftCount} section(s) en brouillon`
                : "Tout est publié"}
          </p>
          <button
            type="button"
            className={pe.publish}
            disabled={pending || draftCount === 0}
            onClick={handlePublish}
          >
            {pending ? "Publication…" : "Publier les modifications"}
          </button>
          <a
            className={pe.preview}
            href={`/api/draft/enable?path=${encodeURIComponent(slug)}`}
            target="_blank"
            rel="noreferrer"
          >
            Aperçu du brouillon ↗
          </a>
          <button
            type="button"
            className={pe.discard}
            disabled={pending || draftCount === 0}
            onClick={handleDiscard}
          >
            Abandonner les brouillons
          </button>
        </div>
      </aside>

      <div className={pe.formCol}>
        {current && currentState && (
          <SectionForm
            key={current.key}
            type={current.type}
            value={currentState.value}
            onChange={(next) => handleChange(current.key, next)}
          />
        )}
      </div>

      {notice && !notice.ok && (
        <div className={pe.noticeErr} role="alert">
          {notice.message}
        </div>
      )}
      {notice?.ok && notice.message && (
        <div className={pe.noticeOk} role="status">
          {notice.message}
        </div>
      )}
    </div>
  );
}
