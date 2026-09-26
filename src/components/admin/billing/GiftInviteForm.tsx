"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Notice } from "@/components/admin/shared";
import { Field, FieldGrid, FormActions } from "@/components/admin/kit/Field";
import { cn } from "@/lib/utils";
import {
  creerInvitation,
  type GiftFormState,
} from "@/app/admin/(protected)/billing/acces-offerts/actions";

/* ============================================================
   Nouvelle invitation d'accès offert.

   Le seul choix qui engage vraiment est « ce qui se passe à la fin ». Il n'a
   pas de valeur par défaut : un bénéficiaire prélevé sans l'avoir compris, ou
   un gagnant à qui l'on demande sa carte alors qu'on voulait lui faire un
   cadeau, sont deux erreurs qui coûtent cher. Il se fait donc en conscience,
   à chaque invitation.
   ============================================================ */

const MONTHS = [1, 2, 3, 6, 9, 12];

const FIN: {
  value: "yes" | "no";
  title: string;
  text: string;
}[] = [
  {
    value: "no",
    title: "Cadeau, sans carte",
    text: "Aucun moyen de paiement demandé. À la fin, le bénéficiaire choisit de s'abonner ; sinon son compte passe en lecture seule (dossiers consultables et exportables).",
  },
  {
    value: "yes",
    title: "Période offerte, puis abonnement",
    text: "Carte demandée à l'inscription, sans aucun prélèvement pendant la période. À la fin, l'abonnement démarre seul, sans engagement, sauf arrêt avant.",
  },
];

export default function GiftInviteForm() {
  const [state, action, pending] = useActionState<GiftFormState, FormData>(
    creerInvitation,
    null,
  );
  const [copied, setCopied] = useState(false);
  const [fin, setFin] = useState<"yes" | "no" | "">("");

  const erreurChamp = (champ: string) =>
    state && !state.ok && state.field === champ ? state.error : undefined;

  return (
    <form
      action={action}
      className="flex flex-col"
      onSubmit={() => setCopied(false)}
    >
      <CardContent className="flex flex-col gap-4">
        <FieldGrid>
          <Field
            span="@narrow/page:col-span-4 @wide/page:col-span-6"
            label="Email du bénéficiaire"
            htmlFor="gift-email"
            required
            error={erreurChamp("email")}
          >
            <Input
              id="gift-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder="prenom.nom@exemple.fr"
              required
              maxLength={180}
            />
          </Field>
          <Field
            span="@narrow/page:col-span-2 @wide/page:col-span-2"
            label="Durée offerte"
            htmlFor="gift-months"
            required
            error={erreurChamp("months")}
          >
            <Select name="months" defaultValue="3" required>
              <SelectTrigger id="gift-months" className="max-w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {m} mois
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            span="@narrow/page:col-span-6 @wide/page:col-span-4"
            label="Motif (note interne)"
            htmlFor="gift-reason"
            required
            error={erreurChamp("reason")}
          >
            <Input
              id="gift-reason"
              name="reason"
              placeholder="Quiz de l'été 2026"
              required
              maxLength={200}
            />
          </Field>
        </FieldGrid>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-cell font-medium text-foreground">
            À la fin de la période offerte
            <span className="text-destructive"> *</span>
          </legend>
          <div className="grid gap-3 @narrow/page:grid-cols-2">
            {FIN.map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-xl border p-3.5 transition-colors",
                  fin === option.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-secondary/50",
                )}
              >
                <input
                  type="radio"
                  name="requireCard"
                  value={option.value}
                  checked={fin === option.value}
                  onChange={() => setFin(option.value)}
                  className="mt-1 accent-[color:var(--primary)]"
                  required
                />
                <span className="min-w-0">
                  <span className="block text-cell font-medium text-foreground">
                    {option.title}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                    {option.text}
                  </span>
                </span>
              </label>
            ))}
          </div>
          {erreurChamp("requireCard") && (
            <p className="text-xs text-destructive">{erreurChamp("requireCard")}</p>
          )}
        </fieldset>

        {state && !state.ok && !state.field && (
          <Notice tone="bad" title="L'invitation n'a pas été envoyée">
            {state.error}
          </Notice>
        )}

        {state?.ok && (
          <Notice
            tone={state.emailSent ? "ok" : "warn"}
            title={
              state.emailSent
                ? `Invitation envoyée à ${state.email} (${state.months} mois offerts)`
                : `Invitation créée, mais l'email à ${state.email} n'est pas parti`
            }
          >
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 overflow-x-auto rounded-md border border-border bg-card px-2.5 py-2 font-mono text-xs">
                {state.link}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(state.link);
                  setCopied(true);
                }}
              >
                {copied ? "Copié" : "Copier"}
              </Button>
            </div>
            <p className="mt-2 text-xs leading-relaxed">
              Vous pouvez aussi transmettre ce lien par message. Il n&apos;est pas
              conservé : pour en obtenir un autre, renvoyez l&apos;invitation
              depuis la liste.
            </p>
          </Notice>
        )}
      </CardContent>

      <FormActions>
        <span className="text-xs text-muted-foreground">
          Lien personnel valable 60 jours, lié à l&apos;adresse invitée qui devient
          l&apos;identifiant de connexion. Le motif n&apos;est jamais montré au
          bénéficiaire.
        </span>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Envoi…" : "Envoyer l'invitation"}
        </Button>
      </FormActions>
    </form>
  );
}
