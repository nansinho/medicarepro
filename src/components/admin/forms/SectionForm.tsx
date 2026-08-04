"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronRight, Plus, Trash2 } from "lucide-react";
import {
  buildFormTree,
  defaultValue,
  type FieldNode,
} from "@/lib/admin/forms/introspect";
import { labelFor, isTextarea, helpFor } from "@/lib/admin/forms/hints";
import { getPath, setPath, ICON_CHOICES } from "@/lib/admin/settings-forms";
import {
  MockupKindSchema,
  ToneSchema,
  ToneWithDarkSchema,
  type SectionType,
} from "@/lib/cms/sections.schema";
import ImagePicker from "@/components/admin/media/ImagePicker";
import RichTextEditor from "@/components/admin/rich-text/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/* ============================================================
   Formulaire d'une section : arbre généré par introspection du
   schéma zod (buildFormTree) + libellés/heuristiques FR (hints).
   Chaque widget édite le payload par dot-path (immuable).
   Les nœuds inconnus tombent sur un éditeur JSON brut : aucun
   des 29 types ne casse, même si un schéma évolue.
   ============================================================ */

const TONE_LABELS: Record<string, string> = {
  white: "Blanc",
  soft: "Bleu très clair",
  medium: "Bleu clair",
  dark: "Foncé",
};

/* <select> natif conservé (état contrôlé, valeur vide gérée),
   simplement restylé au registre shadcn. */
const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

/** Marqueur « (optionnel) » discret après un libellé. */
function OptionalTag() {
  return <span className="font-normal text-muted-foreground">(optionnel)</span>;
}

export type SectionFormProps = {
  type: SectionType;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
};

export default function SectionForm({ type, value, onChange }: SectionFormProps) {
  const tree = useMemo(() => buildFormTree(type), [type]);
  return <FieldsRenderer tree={tree} type={type} value={value} onChange={onChange} />;
}

/** Rendu générique d'un arbre de champs (réutilisé par les collections). */
export function FieldsRenderer({
  tree,
  type = null,
  value,
  onChange,
}: {
  tree: FieldNode[];
  type?: SectionType | null;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {tree.map((node) => (
        <Field
          key={node.path}
          node={node}
          type={type}
          root={value}
          onChange={onChange}
        />
      ))}
    </div>
  );
}

function Field({
  node,
  type,
  root,
  onChange,
  pathOverride,
}: {
  node: FieldNode;
  type: SectionType | null;
  root: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  /** Chemin réel (éléments de tableau : item.path est relatif). */
  pathOverride?: string;
}) {
  const path = pathOverride ?? node.path;
  const current = getPath(root, path);
  const set = (v: unknown) => onChange(setPath(root, path, v));
  const label = labelFor(path);
  const help = type ? helpFor(type, node.path || path) : undefined;

  switch (node.kind) {
    case "string": {
      const multiline = isTextarea(path);
      return (
        <div className="flex flex-col gap-1.5">
          <Label className="gap-1">
            {label}
            {node.optional && <OptionalTag />}
          </Label>
          {multiline ? (
            <Textarea
              rows={3}
              value={String(current ?? "")}
              onChange={(e) => set(e.target.value)}
            />
          ) : (
            <Input
              type="text"
              value={String(current ?? "")}
              onChange={(e) => set(e.target.value)}
            />
          )}
          {help && <p className="text-xs text-muted-foreground">{help}</p>}
        </div>
      );
    }
    case "number":
      return (
        <div className="flex flex-col gap-1.5">
          <Label className="gap-1">
            {label}
            {node.optional && <OptionalTag />}
          </Label>
          <Input
            type="number"
            step="any"
            value={current == null ? "" : Number(current)}
            onChange={(e) =>
              set(e.target.value === "" ? (node.optional ? undefined : 0) : Number(e.target.value))
            }
          />
          {help && <p className="text-xs text-muted-foreground">{help}</p>}
        </div>
      );
    case "boolean":
      return (
        <div className="flex items-center gap-2.5">
          <Switch
            id={`bool-${path}`}
            checked={Boolean(current)}
            onCheckedChange={(v) => set(v)}
          />
          <Label htmlFor={`bool-${path}`} className="cursor-pointer">
            {label}
          </Label>
        </div>
      );
    case "enum":
    case "iconKey":
    case "tone":
    case "toneDark":
    case "mockup": {
      const values: readonly string[] =
        node.kind === "enum"
          ? node.values
          : node.kind === "iconKey"
            ? ICON_CHOICES
            : node.kind === "mockup"
              ? MockupKindSchema.options
              : node.kind === "toneDark"
                ? ToneWithDarkSchema.options
                : ToneSchema.options;
      const isTone = node.kind === "tone" || node.kind === "toneDark";
      return (
        <div className="flex flex-col gap-1.5">
          <Label className="gap-1">
            {label}
            {node.optional && <OptionalTag />}
          </Label>
          <select
            className={SELECT_CLASS}
            value={current == null ? "" : String(current)}
            onChange={(e) => set(e.target.value === "" ? undefined : e.target.value)}
          >
            {node.optional && <option value="">—</option>}
            {values.map((v) => (
              <option key={v} value={v}>
                {isTone ? (TONE_LABELS[v] ?? v) : v}
              </option>
            ))}
          </select>
        </div>
      );
    }
    case "imageRef": {
      const ref = (current ?? { mediaId: null, path: "", alt: "" }) as {
        mediaId: string | null;
        path: string;
        alt: string;
      };
      return <ImagePicker value={ref} onChange={set} label={label} />;
    }
    case "linkRef": {
      const link = (current ?? { label: "", href: "" }) as {
        label: string;
        href: string;
      };
      return (
        <div className="flex flex-col gap-1.5">
          <Label>{label}</Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1.4fr]">
            <Input
              type="text"
              placeholder="Libellé"
              value={link.label}
              onChange={(e) => set({ ...link, label: e.target.value })}
            />
            <Input
              type="text"
              placeholder="/tarifs, https://…, app:register"
              list="linkref-hrefs"
              value={link.href}
              onChange={(e) => set({ ...link, href: e.target.value })}
            />
            <datalist id="linkref-hrefs">
              <option value="/tarifs" />
              <option value="/contact" />
              <option value="/fonctionnalites" />
              <option value="app:register" />
              <option value="app:register:annual" />
              <option value="app:register:monthly" />
              <option value="app:login" />
            </datalist>
          </div>
        </div>
      );
    }
    case "richBody":
      return (
        <div className="flex flex-col gap-1.5">
          <Label>{label}</Label>
          <RichTextEditor
            value={(current ?? { type: "doc", content: [] }) as Record<string, unknown>}
            onChange={set}
            variant="legal"
          />
        </div>
      );
    case "object":
      return (
        <fieldset className="flex min-w-0 flex-col gap-3 rounded-lg border border-border p-3.5">
          <legend className="px-1.5 text-xs font-semibold text-muted-foreground">
            {label}
          </legend>
          {node.fields.map((child) => (
            <Field
              key={child.path}
              node={child}
              type={type}
              root={root}
              onChange={onChange}
              pathOverride={
                pathOverride
                  ? `${pathOverride}.${child.path.split(".").pop()}`
                  : child.path
              }
            />
          ))}
        </fieldset>
      );
    case "array": {
      const rows = Array.isArray(current) ? (current as unknown[]) : [];
      return (
        <ArrayField
          label={label}
          rows={rows}
          node={node}
          type={type}
          root={root}
          path={path}
          onChange={onChange}
        />
      );
    }
    default:
      return (
        <div className="flex flex-col gap-1.5">
          <Label>{label} (JSON avancé)</Label>
          <JsonField value={current} onCommit={set} />
        </div>
      );
  }
}

function ArrayField({
  label,
  rows,
  node,
  type,
  root,
  path,
  onChange,
}: {
  label: string;
  rows: unknown[];
  node: Extract<FieldNode, { kind: "array" }>;
  type: SectionType | null;
  root: Record<string, unknown>;
  path: string;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const [open, setOpen] = useState<number | null>(rows.length > 0 ? null : null);
  const setRows = (next: unknown[]) => onChange(setPath(root, path, next));

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    setRows(next);
    setOpen(target);
  };

  /* Résumé texte d'un élément (première valeur string trouvée). */
  const summary = (row: unknown): string => {
    if (row == null) return "(vide)";
    if (typeof row === "string") return row.slice(0, 60) || "(vide)";
    if (typeof row === "object") {
      for (const value of Object.values(row as Record<string, unknown>)) {
        if (typeof value === "string" && value.trim()) return value.slice(0, 60);
      }
    }
    return "(élément)";
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground">
        {label}{" "}
        <span className="text-xs font-normal text-muted-foreground">
          ({rows.length})
        </span>
      </span>
      {rows.map((row, index) => (
        <div
          key={index}
          className="rounded-lg border border-border bg-secondary/30"
        >
          <div className="flex items-center gap-1 p-1.5">
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-foreground transition-colors hover:bg-accent"
              onClick={() => setOpen(open === index ? null : index)}
              aria-expanded={open === index}
            >
              <ChevronRight
                className={cn(
                  "size-3.5 shrink-0 text-muted-foreground transition-transform",
                  open === index && "rotate-90",
                )}
              />
              <b className="font-medium text-muted-foreground">{index + 1}.</b>
              <span className="truncate">{summary(row)}</span>
            </button>
            <div className="flex items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label="Monter"
              >
                <ArrowUp />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => move(index, 1)}
                disabled={index === rows.length - 1}
                aria-label="Descendre"
              >
                <ArrowDown />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:bg-bad/10 hover:text-bad"
                onClick={() => setRows(rows.filter((_, i) => i !== index))}
                aria-label="Supprimer"
              >
                <Trash2 />
              </Button>
            </div>
          </div>
          {open === index && (
            <div className="flex flex-col gap-3 border-t border-border p-3">
              {node.item.kind === "object" ? (
                node.item.fields.map((child) => (
                  <Field
                    key={child.path}
                    node={child}
                    type={type}
                    root={root}
                    onChange={onChange}
                    pathOverride={`${path}.${index}.${child.path.split(".").pop()}`}
                  />
                ))
              ) : (
                <Field
                  node={node.item}
                  type={type}
                  root={root}
                  onChange={onChange}
                  pathOverride={`${path}.${index}`}
                />
              )}
            </div>
          )}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => {
          setRows([...rows, defaultValue(node.item)]);
          setOpen(rows.length);
        }}
      >
        <Plus />
        Ajouter
      </Button>
    </div>
  );
}

/** Éditeur JSON brut (nœuds hors allowlist d'introspection). */
function JsonField({
  value,
  onCommit,
}: {
  value: unknown;
  onCommit: (v: unknown) => void;
}) {
  const [text, setText] = useState(() => JSON.stringify(value ?? null, null, 2));
  const [invalid, setInvalid] = useState(false);
  return (
    <>
      <Textarea
        rows={6}
        aria-invalid={invalid}
        className="font-mono text-xs"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          try {
            onCommit(JSON.parse(e.target.value));
            setInvalid(false);
          } catch {
            setInvalid(true);
          }
        }}
        spellCheck={false}
      />
      {invalid && (
        <p className="mt-1 text-xs text-bad">JSON invalide, non enregistré.</p>
      )}
    </>
  );
}
