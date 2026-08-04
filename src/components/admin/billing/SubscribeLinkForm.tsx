"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  creerLienSouscription,
  rechercherCabinet,
  type LinkState,
  type SearchState,
  type FoundCabinet,
} from "@/app/admin/(protected)/billing/souscriptions/actions";

/* ============================================================
   Émission d'un lien de souscription pour un cabinet existant.

   On CHERCHE le cabinet, on ne le ressaisit pas. L'identifiant technique
   (« cmrg49kym001pizc12p1cnkg5 ») ne se recopie pas à la main : mal relevé, il
   rattache l'abonnement — donc le prélèvement — au mauvais cabinet. La
   recherche par email interroge l'application et remplit tout le reste.

   Le lien produit vaut accès : affiché une seule fois, à usage unique, quinze
   minutes de validité. Il n'est ni envoyé par email (il serait périmé à
   l'ouverture) ni conservé.
   ============================================================ */

const FIELDS: { name: string; label: string; required?: boolean }[] = [
  { name: "name", label: "Nom du cabinet", required: true },
  { name: "adminName", label: "Nom de l'administrateur" },
  { name: "adminEmail", label: "Email de l'administrateur", required: true },
  { name: "address", label: "Adresse", required: true },
  { name: "postalCode", label: "Code postal", required: true },
  { name: "city", label: "Ville", required: true },
  { name: "invoicePrefix", label: "Préfixe de facturation" },
  { name: "siretNumber", label: "SIRET" },
];

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "abonnement actif",
  PAST_DUE: "impayé en cours",
  SUSPENDED: "suspendu",
  CANCELED: "résilié",
  EXPIRED: "expiré",
};

export default function SubscribeLinkForm() {
  const [search, searchAction, searching] = useActionState<SearchState, FormData>(
    rechercherCabinet,
    null,
  );
  const [state, formAction, pending] = useActionState<LinkState, FormData>(
    creerLienSouscription,
    null,
  );
  const [copied, setCopied] = useState(false);
  /* Le cabinet affiché est DÉRIVÉ du résultat de recherche, jamais recopié
     dans un état local : recopier imposerait un effet, et un effet qui appelle
     setState relance un rendu pour rien. « Changer de cabinet » se contente
     donc de masquer le résultat courant, et toute nouvelle recherche le
     réaffiche (onSubmit, un événement, pas un effet). */
  const [dismissed, setDismissed] = useState(false);
  const cabinet: FoundCabinet | null =
    !dismissed && search?.ok ? search.cabinet : null;

  /* --- Étape 1 : trouver le cabinet. --------------------------------- */
  if (!cabinet) {
    return (
      <form
        action={searchAction}
        onSubmit={() => setDismissed(false)}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sub-query">
            Email du cabinet ou de son administrateur
            <span className="text-destructive"> *</span>
          </Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="sub-query"
              name="query"
              placeholder="contact@cabinet-dupont.fr"
              className="min-w-[280px] flex-1"
              required
              autoFocus
            />
            <Button type="submit" disabled={searching}>
              {searching ? "Recherche…" : "Rechercher"}
            </Button>
          </div>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            Le cabinet est cherché dans l&apos;application, qui renvoie ses
            coordonnées et son identifiant. Un identifiant technique peut aussi
            être collé directement.
          </p>
        </div>

        {search && !search.ok && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/8 p-3.5 text-[13px] text-foreground"
          >
            {search.error}
          </div>
        )}
      </form>
    );
  }

  /* --- Étape 2 : confirmer et émettre. ------------------------------- */
  const alreadySubscribed =
    cabinet.subscriptionStatus === "ACTIVE" ||
    cabinet.subscriptionStatus === "PAST_DUE";

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-card p-3.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-medium text-foreground">
              {cabinet.name || "(cabinet sans nom)"}
            </span>
            {cabinet.subscriptionStatus ? (
              <Badge variant={alreadySubscribed ? "amber" : "gray"}>
                {STATUS_LABEL[cabinet.subscriptionStatus] ??
                  cabinet.subscriptionStatus}
              </Badge>
            ) : (
              <Badge variant="blue">aucun abonnement</Badge>
            )}
          </div>
          <p className="mt-1 font-mono text-[12px] text-muted-foreground">
            {cabinet.id}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setDismissed(true)}
        >
          Changer de cabinet
        </Button>
      </div>

      {alreadySubscribed && (
        <div
          role="alert"
          className="rounded-lg border border-[color:var(--warn)]/30 bg-[color:var(--warn)]/8 p-3.5 text-[13px] text-foreground"
        >
          Ce cabinet a déjà un abonnement en cours côté application. Ouvrir une
          souscription créerait un doublon : la commande sera refusée. Passez
          plutôt par sa fiche dans <b>Abonnements</b>.
        </div>
      )}

      <input type="hidden" name="cabinetId" value={cabinet.id} />
      <input type="hidden" name="email" value={cabinet.email} />

      {/* Coordonnées pré-remplies, restées modifiables : elles figurent sur la
          facture, et l'application n'a pas toujours l'adresse à jour. */}
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
              required={f.required}
              defaultValue={(cabinet[f.name as keyof FoundCabinet] as string) ?? ""}
            />
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
