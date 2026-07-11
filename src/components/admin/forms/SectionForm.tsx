"use client";

import { useMemo, useState } from "react";
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
import { Caret } from "@/components/icons";
import f from "./forms.module.css";

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
    <div className={f.form}>
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
        <label className={f.field}>
          <span>
            {label}
            {node.optional && <em> (optionnel)</em>}
          </span>
          {multiline ? (
            <textarea
              rows={3}
              value={String(current ?? "")}
              onChange={(e) => set(e.target.value)}
            />
          ) : (
            <input
              type="text"
              value={String(current ?? "")}
              onChange={(e) => set(e.target.value)}
            />
          )}
          {help && <small>{help}</small>}
        </label>
      );
    }
    case "number":
      return (
        <label className={f.field}>
          <span>
            {label}
            {node.optional && <em> (optionnel)</em>}
          </span>
          <input
            type="number"
            step="any"
            value={current == null ? "" : Number(current)}
            onChange={(e) =>
              set(e.target.value === "" ? (node.optional ? undefined : 0) : Number(e.target.value))
            }
          />
        </label>
      );
    case "boolean":
      return (
        <label className={f.toggle}>
          <input
            type="checkbox"
            checked={Boolean(current)}
            onChange={(e) => set(e.target.checked)}
          />
          <span>{label}</span>
        </label>
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
        <label className={f.field}>
          <span>
            {label}
            {node.optional && <em> (optionnel)</em>}
          </span>
          <select
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
        </label>
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
        <div className={f.linkRef}>
          <span className={f.groupLabel}>{label}</span>
          <div className={f.linkRow}>
            <input
              type="text"
              placeholder="Libellé"
              value={link.label}
              onChange={(e) => set({ ...link, label: e.target.value })}
            />
            <input
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
        <div className={f.rich}>
          <span className={f.groupLabel}>{label}</span>
          <RichTextEditor
            value={(current ?? { type: "doc", content: [] }) as Record<string, unknown>}
            onChange={set}
            variant="legal"
          />
        </div>
      );
    case "object":
      return (
        <fieldset className={f.group}>
          <legend>{label}</legend>
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
        <label className={f.field}>
          <span>{label} (avancé — JSON)</span>
          <JsonField value={current} onCommit={set} />
        </label>
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
    <div className={f.array}>
      <span className={f.groupLabel}>
        {label} <small>({rows.length})</small>
      </span>
      {rows.map((row, index) => (
        <div key={index} className={f.arrayItem}>
          <div className={f.arrayItemHead}>
            <button
              type="button"
              className={f.arrayToggle}
              onClick={() => setOpen(open === index ? null : index)}
              aria-expanded={open === index}
            >
              <Caret
                width={13}
                height={13}
                className={open === index ? f.caretOpen : undefined}
              />
              <b>{index + 1}.</b> {summary(row)}
            </button>
            <div className={f.arrayItemActions}>
              <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Monter">↑</button>
              <button type="button" onClick={() => move(index, 1)} disabled={index === rows.length - 1} aria-label="Descendre">↓</button>
              <button
                type="button"
                className={f.arrayRemove}
                aria-label="Supprimer"
                onClick={() => setRows(rows.filter((_, i) => i !== index))}
              >
                ✕
              </button>
            </div>
          </div>
          {open === index && (
            <div className={f.arrayItemBody}>
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
      <button
        type="button"
        className={f.arrayAdd}
        onClick={() => {
          setRows([...rows, defaultValue(node.item)]);
          setOpen(rows.length);
        }}
      >
        + Ajouter
      </button>
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
      <textarea
        rows={6}
        className={invalid ? f.jsonInvalid : undefined}
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
      {invalid && <small className={f.jsonError}>JSON invalide — non enregistré.</small>}
    </>
  );
}
