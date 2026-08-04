"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  creerLienSouscription,
  type LinkState,
} from "@/app/admin/(protected)/billing/souscriptions/actions";

/* ============================================================
   Émission d'un lien de souscription pour un cabinet existant.

   Le lien vaut accès : il n'est affiché qu'ici, une seule fois, et expire en
   quinze minutes. On ne l'envoie donc pas par email (il serait périmé) et on
   ne le stocke nulle part en clair.
   ============================================================ */

const FIELDS: {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  hint?: string;
}[] = [
  {
    name: "cabinetId",
    label: "Identifiant du cabinet dans l'application",
    placeholder: "cmrg49kym001pizc12p1cnkg5",
    required: true,
    hint: "À copier depuis le back-office de l'application (fiche cabinet). C'est lui qui rattache l'abonnement au bon compte.",
  },
  { name: "name", label: "Nom du cabinet", required: true },
  { name: "adminName", label: "Nom de l'administrateur" },
  { name: "adminEmail", label: "Email de l'administrateur", required: true },
  { name: "address", label: "Adresse", required: true },
  { name: "postalCode", label: "Code postal", required: true },
  { name: "city", label: "Ville", required: true },
  {
    name: "invoicePrefix",
    label: "Préfixe de facturation",
    hint: "Celui déjà attribué au cabinet dans l'application — ne pas en inventer un nouveau.",
  },
  { name: "siretNumber", label: "SIRET" },
];

export default function SubscribeLinkForm() {
  const [state, formAction, pending] = useActionState<LinkState, FormData>(
    creerLienSouscription,
    null,
  );
  const [copied, setCopied] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {FIELDS.map((f) => (
          <div key={f.name} className="flex flex-col gap-1.5">
            <Label htmlFor={`sub-${f.name}`}>
              {f.label}
              {f.required && <span className="text-destructive"> *</span>}
            </Label>
            <Input
              id={`sub-${f.name}`}
              name={f.name}
              placeholder={f.placeholder}
              required={f.required}
            />
            {f.hint && (
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                {f.hint}
              </p>
            )}
          </div>
        ))}
      </div>

      <label className="flex items-start gap-2.5 text-[13px] text-muted-foreground">
        <input type="checkbox" name="notify" className="mt-0.5 size-4" />
        <span>
          Prévenir le praticien par email que son abonnement va être mis en
          place. Le message ne contient PAS le lien (il expire en 15 minutes) :
          il annonce simplement la démarche.
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Création du lien…" : "Créer le lien de souscription"}
        </Button>
        <p className="text-[12px] text-muted-foreground">
          Le lien est à usage unique et expire en 15 minutes.
        </p>
      </div>

      {state && !state.ok && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/8 p-3.5 text-[13px] text-foreground"
        >
          {state.error}
        </div>
      )}

      {state?.ok && (
        <div className="rounded-lg border border-[color:var(--ok)]/30 bg-[color:var(--ok)]/8 p-3.5">
          <div className="mb-2 text-[13px] font-medium text-foreground">
            Lien créé{state.notified ? " et praticien prévenu par email" : ""} —
            valable jusqu&apos;à{" "}
            {new Intl.DateTimeFormat("fr-FR", {
              timeStyle: "short",
              timeZone: "Europe/Paris",
            }).format(new Date(state.expiresAt))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded border border-border bg-card px-2.5 py-2 font-mono text-[12px]">
              {state.url}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(state.url);
                setCopied(true);
              }}
            >
              {copied ? "Copié" : "Copier"}
            </Button>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
            Transmettez-le par un canal immédiat (téléphone, message). Il ne
            sera plus affiché après avoir quitté cette page.
          </p>
        </div>
      )}
    </form>
  );
}
