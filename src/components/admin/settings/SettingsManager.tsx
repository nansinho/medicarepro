"use client";

import { useState, useTransition } from "react";
import { saveSetting } from "@/app/admin/(protected)/reglages/actions";
import {
  getPath,
  setPath,
  ICON_CHOICES,
  SETTINGS_SECTIONS,
  type EditableSettingKey,
  type SettingField,
  type SettingSection,
} from "@/lib/admin/settings-forms";
import { Caret, Check } from "@/components/icons";
import st from "./settings.module.css";

/* ============================================================
   Gestionnaire des réglages : un panneau dépliable par clé,
   formulaires générés depuis les descripteurs (settings-forms).
   Chaque panneau s'enregistre indépendamment via saveSetting.
   ============================================================ */

export default function SettingsManager({
  initialValues,
}: {
  initialValues: Record<EditableSettingKey, unknown>;
}) {
  const [values, setValues] = useState(initialValues);
  const [open, setOpen] = useState<EditableSettingKey | null>(
    SETTINGS_SECTIONS[0]?.key ?? null,
  );

  return (
    <div className={st.stack}>
      {SETTINGS_SECTIONS.map((section) => (
        <SectionPanel
          key={section.key}
          section={section}
          value={values[section.key]}
          open={open === section.key}
          onToggle={() =>
            setOpen(open === section.key ? null : section.key)
          }
          onChange={(next) =>
            setValues((prev) => ({ ...prev, [section.key]: next }))
          }
        />
      ))}
    </div>
  );
}

function SectionPanel({
  section,
  value,
  open,
  onToggle,
  onChange,
}: {
  section: SettingSection;
  value: unknown;
  open: boolean;
  onToggle: () => void;
  onChange: (next: unknown) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<
    { kind: "idle" } | { kind: "saved" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  function handleSave() {
    startTransition(async () => {
      const result = await saveSetting(section.key, value);
      setState(
        result.ok
          ? { kind: "saved" }
          : { kind: "error", message: result.message },
      );
      if (result.ok) {
        window.setTimeout(() => setState({ kind: "idle" }), 2500);
      }
    });
  }

  return (
    <section className={st.panel}>
      <button
        type="button"
        className={st.panelHead}
        onClick={onToggle}
        aria-expanded={open}
      >
        <span>
          <b>{section.title}</b>
          <small>{section.description}</small>
        </span>
        <Caret
          width={16}
          height={16}
          className={open ? st.caretOpen : st.caret}
        />
      </button>

      {open && (
        <div className={st.panelBody}>
          {section.fields.map((field) => (
            <Field
              key={field.path || field.label}
              field={field}
              value={value}
              onChange={onChange}
            />
          ))}

          <div className={st.panelFoot}>
            {state.kind === "error" && (
              <p className={st.error} role="alert">
                {state.message}
              </p>
            )}
            <button
              type="button"
              className={st.saveBtn}
              disabled={pending}
              onClick={handleSave}
            >
              {pending ? (
                "Enregistrement…"
              ) : state.kind === "saved" ? (
                <>
                  <Check width={14} height={14} /> Enregistré — site à jour
                </>
              ) : (
                "Enregistrer"
              )}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Field({
  field,
  value,
  onChange,
}: {
  field: SettingField;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const current = getPath(value, field.path);

  if (field.kind === "toggle") {
    return (
      <label className={st.toggleRow}>
        <input
          type="checkbox"
          checked={Boolean(current)}
          onChange={(e) => onChange(setPath(value, field.path, e.target.checked))}
        />
        <span>{field.label}</span>
        {field.help && <small>{field.help}</small>}
      </label>
    );
  }

  if (field.kind === "text" || field.kind === "textarea") {
    return (
      <label className={st.field}>
        <span>{field.label}</span>
        {field.kind === "textarea" ? (
          <textarea
            rows={3}
            value={String(current ?? "")}
            onChange={(e) => onChange(setPath(value, field.path, e.target.value))}
          />
        ) : (
          <input
            type="text"
            value={String(current ?? "")}
            onChange={(e) => onChange(setPath(value, field.path, e.target.value))}
          />
        )}
        {field.help && <small>{field.help}</small>}
      </label>
    );
  }

  if (field.kind === "icon") {
    return (
      <label className={st.field}>
        <span>{field.label}</span>
        <select
          value={current == null ? "" : String(current)}
          onChange={(e) =>
            onChange(
              setPath(value, field.path, e.target.value === "" ? null : e.target.value),
            )
          }
        >
          {field.allowNone && <option value="">Aucune</option>}
          {ICON_CHOICES.map((icon) => (
            <option key={icon} value={icon}>
              {icon}
            </option>
          ))}
        </select>
      </label>
    );
  }

  /* Tableau d'objets (réseaux sociaux, badges…) */
  if (field.kind !== "array") return null;
  const { columns, newItem } = field;
  const rows = Array.isArray(current) ? current : [];
  return (
    <div className={st.arrayField}>
      <span className={st.arrayLabel}>{field.label}</span>
      {rows.map((row, index) => (
        <div key={index} className={st.arrayRow}>
          {columns.map((col) => {
            const colValue = getPath(row, col.path);
            const rowPath = field.path ? `${field.path}.${index}` : String(index);
            if (col.kind === "icon") {
              return (
                <select
                  key={col.path}
                  aria-label={col.label}
                  value={colValue == null ? "" : String(colValue)}
                  onChange={(e) =>
                    onChange(
                      setPath(
                        value,
                        `${rowPath}.${col.path}`,
                        e.target.value === "" ? null : e.target.value,
                      ),
                    )
                  }
                >
                  {col.allowNone && <option value="">Aucune</option>}
                  {ICON_CHOICES.map((icon) => (
                    <option key={icon} value={icon}>
                      {icon}
                    </option>
                  ))}
                </select>
              );
            }
            return (
              <input
                key={col.path}
                type="text"
                aria-label={col.label}
                placeholder={col.label}
                value={String(colValue ?? "")}
                onChange={(e) =>
                  onChange(setPath(value, `${rowPath}.${col.path}`, e.target.value))
                }
              />
            );
          })}
          <button
            type="button"
            className={st.rowRemove}
            aria-label="Supprimer la ligne"
            onClick={() =>
              onChange(
                setPath(
                  value,
                  field.path,
                  rows.filter((_, i) => i !== index),
                ),
              )
            }
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className={st.rowAdd}
        onClick={() =>
          onChange(setPath(value, field.path, [...rows, newItem()]))
        }
      >
        + Ajouter
      </button>
    </div>
  );
}
