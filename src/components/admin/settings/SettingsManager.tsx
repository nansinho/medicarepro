"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
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
import { Notice } from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/* ============================================================
   Gestionnaire des réglages : une carte par clé, formulaires
   générés depuis les descripteurs (settings-forms). Chaque carte
   s'enregistre indépendamment via saveSetting.
   ============================================================ */

/* Champ natif (select) aligné visuellement sur le composant Input. */
const SELECT_CLASS =
  "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

export default function SettingsManager({
  initialValues,
}: {
  initialValues: Record<EditableSettingKey, unknown>;
}) {
  const [values, setValues] = useState(initialValues);

  return (
    <div className="flex flex-col gap-4">
      {SETTINGS_SECTIONS.map((section) => (
        <SectionCard
          key={section.key}
          section={section}
          value={values[section.key]}
          onChange={(next) =>
            setValues((prev) => ({ ...prev, [section.key]: next }))
          }
        />
      ))}
    </div>
  );
}

function SectionCard({
  section,
  value,
  onChange,
}: {
  section: SettingSection;
  value: unknown;
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
    <Card>
      <CardHeader className="flex-col items-start gap-1 py-3">
        <CardTitle>{section.title}</CardTitle>
        <p className="text-xs text-muted-foreground">{section.description}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {section.fields.map((field) => (
          <Field
            key={field.path || field.label}
            field={field}
            value={value}
            onChange={onChange}
          />
        ))}

        {state.kind === "error" && (
          <Notice tone="bad" title="Erreur">
            {state.message}
          </Notice>
        )}
        {state.kind === "saved" && (
          <Notice tone="ok" title="Enregistré">
            Le site est à jour.
          </Notice>
        )}

        <div className="flex justify-end">
          <Button type="button" disabled={pending} onClick={handleSave}>
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </CardContent>
    </Card>
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
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <Label>{field.label}</Label>
          {field.help && (
            <p className="text-xs text-muted-foreground">{field.help}</p>
          )}
        </div>
        <Switch
          checked={Boolean(current)}
          onCheckedChange={(checked) =>
            onChange(setPath(value, field.path, checked))
          }
        />
      </div>
    );
  }

  if (field.kind === "text" || field.kind === "textarea") {
    return (
      <div className="flex flex-col gap-1.5">
        <Label>{field.label}</Label>
        {field.kind === "textarea" ? (
          <Textarea
            rows={3}
            value={String(current ?? "")}
            onChange={(e) =>
              onChange(setPath(value, field.path, e.target.value))
            }
          />
        ) : (
          <Input
            type="text"
            value={String(current ?? "")}
            onChange={(e) =>
              onChange(setPath(value, field.path, e.target.value))
            }
          />
        )}
        {field.help && (
          <p className="text-xs text-muted-foreground">{field.help}</p>
        )}
      </div>
    );
  }

  if (field.kind === "icon") {
    return (
      <div className="flex flex-col gap-1.5">
        <Label>{field.label}</Label>
        <select
          className={SELECT_CLASS}
          value={current == null ? "" : String(current)}
          onChange={(e) =>
            onChange(
              setPath(
                value,
                field.path,
                e.target.value === "" ? null : e.target.value,
              ),
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
      </div>
    );
  }

  /* Tableau d'objets (réseaux sociaux, badges…) */
  if (field.kind !== "array") return null;
  const { columns, newItem } = field;
  const rows = Array.isArray(current) ? current : [];
  return (
    <div className="flex flex-col gap-2">
      <Label>{field.label}</Label>
      {rows.map((row, index) => (
        <div key={index} className="flex items-center gap-2">
          {columns.map((col) => {
            const colValue = getPath(row, col.path);
            const rowPath = field.path ? `${field.path}.${index}` : String(index);
            if (col.kind === "icon") {
              return (
                <select
                  key={col.path}
                  aria-label={col.label}
                  className={cn(SELECT_CLASS, "flex-1")}
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
              <Input
                key={col.path}
                type="text"
                aria-label={col.label}
                placeholder={col.label}
                className="flex-1"
                value={String(colValue ?? "")}
                onChange={(e) =>
                  onChange(setPath(value, `${rowPath}.${col.path}`, e.target.value))
                }
              />
            );
          })}
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="flex-none"
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
            <X />
          </Button>
        </div>
      ))}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onChange(setPath(value, field.path, [...rows, newItem()]))
          }
        >
          <Plus />
          Ajouter
        </Button>
      </div>
    </div>
  );
}
