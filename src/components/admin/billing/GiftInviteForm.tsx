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
import {
  creerInvitation,
  type GiftFormState,
} from "@/app/admin/(protected)/billing/acces-offerts/actions";

/* ============================================================
   Nouvelle invitation d'accès offert.

   AUCUNE CARTE N'EST JAMAIS DEMANDÉE. Le choix « carte demandée ou non »
   existait jusqu'au 01/10/2026 ; il a été retiré à la demande du dirigeant :
   un cadeau qui réclame une carte n'est plus perçu comme un cadeau, et les
   invités renonçaient. À la fin de la période, le bénéficiaire s'abonne s'il
   veut continuer, sinon son compte passe en lecture seule.
   ============================================================ */

const MONTHS = [1, 2, 3, 6, 9, 12];

export default function GiftInviteForm() {
  const [state, action, pending] = useActionState<GiftFormState, FormData>(
    creerInvitation,
    null,
  );
  const [copied, setCopied] = useState(false);

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

        <p className="text-xs leading-relaxed text-muted-foreground">
          Aucune carte bancaire n&apos;est demandée au bénéficiaire et rien
          n&apos;est prélevé. À la fin de la période, il s&apos;abonne s&apos;il
          veut continuer ; sinon son compte passe en lecture seule (dossiers
          consultables et exportables).
        </p>

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
