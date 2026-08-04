"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CardContent } from "@/components/ui/card";
import { Notice } from "@/components/admin/shared";
import { Field, FieldGrid, FormActions } from "@/components/admin/kit/Field";
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

type FieldSpec = {
  name: string;
  label: string;
  required?: boolean;
  /** Portées : chaînes LITTÉRALES, sinon Tailwind ne les génère pas. */
  span: string;
  /** Largeur intrinsèque : un code postal ne fait pas 500px. */
  width?: string;
  inputMode?: "numeric";
};

/* Deux rangées pleines à 12 colonnes (3+3+4+2 puis 4+2+4+2), et les mêmes
   portées se recomposent en quatre rangées à 6 colonnes. Les libellés ont été
   raccourcis pour tenir sur une ligne : c'est leur retour à la ligne qui
   désalignait les champs d'une même rangée. */
const FIELDS: FieldSpec[] = [
  { name: "name", label: "Nom du cabinet", required: true, span: "@narrow/page:col-span-3" },
  { name: "adminName", label: "Administrateur", span: "@narrow/page:col-span-3" },
  {
    name: "adminEmail",
    label: "Email administrateur",
    required: true,
    span: "@narrow/page:col-span-4",
  },
  {
    name: "siretNumber",
    label: "SIRET",
    span: "@narrow/page:col-span-2",
    width: "max-w-[220px]",
    inputMode: "numeric",
  },
  { name: "address", label: "Adresse", required: true, span: "@narrow/page:col-span-4" },
  {
    name: "postalCode",
    label: "Code postal",
    required: true,
    span: "@narrow/page:col-span-2",
    width: "max-w-[140px]",
    inputMode: "numeric",
  },
  {
    name: "city",
    label: "Ville",
    required: true,
    span: "@narrow/page:col-span-4",
    width: "max-w-[320px]",
  },
  {
    name: "invoicePrefix",
    label: "Préfixe facture",
    span: "@narrow/page:col-span-2",
    width: "max-w-[180px]",
  },
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
      <form action={searchAction} onSubmit={() => setDismissed(false)}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex max-w-[560px] flex-col gap-1.5">
            <Label htmlFor="sub-query">
              Email du cabinet ou de son administrateur
              <span className="text-destructive"> *</span>
            </Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="sub-query"
                name="query"
                placeholder="contact@cabinet-dupont.fr"
                className="min-w-[260px] flex-1"
                required
                autoFocus
              />
              <Button type="submit" disabled={searching}>
                {searching ? "Recherche…" : "Rechercher"}
              </Button>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Le cabinet est cherché dans l&apos;application, qui renvoie ses
              coordonnées et son identifiant. Un identifiant technique peut aussi
              être collé directement.
            </p>
          </div>

          {search && !search.ok && (
            <Notice tone="bad" title="Cabinet introuvable">
              {search.error}
            </Notice>
          )}
        </CardContent>
      </form>
    );
  }

  /* --- Étape 2 : confirmer et émettre. ------------------------------- */
  const alreadySubscribed =
    cabinet.subscriptionStatus === "ACTIVE" ||
    cabinet.subscriptionStatus === "PAST_DUE";

  return (
    <form action={formAction} className="flex flex-col">
      <CardContent className="flex flex-col gap-4">
        <div className="flex max-w-[900px] flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-secondary/40 p-3.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-medium text-foreground">
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
            <p className="mt-1 font-mono text-xs text-muted-foreground">
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
          <Notice tone="warn" title="Abonnement déjà en cours">
            Ce cabinet a déjà un abonnement en cours côté application. Ouvrir une
            souscription créerait un doublon : la commande sera refusée. Passez
            plutôt par sa fiche dans <b>Abonnements</b>.
          </Notice>
        )}

        <input type="hidden" name="cabinetId" value={cabinet.id} />
        <input type="hidden" name="email" value={cabinet.email} />

        {/* Coordonnées pré-remplies, restées modifiables : elles figurent sur la
            facture, et l'application n'a pas toujours l'adresse à jour. */}
        <FieldGrid>
          {FIELDS.map((f) => (
            <Field
              key={f.name}
              span={f.span}
              label={f.label}
              htmlFor={`sub-${f.name}`}
              required={f.required}
            >
              <Input
                id={`sub-${f.name}`}
                name={f.name}
                inputMode={f.inputMode}
                required={f.required}
                className={f.width}
                defaultValue={
                  (cabinet[f.name as keyof FoundCabinet] as string) ?? ""
                }
              />
            </Field>
          ))}
        </FieldGrid>

        {state && !state.ok && (
          <Notice tone="bad" title="Le lien n'a pas été créé">
            {state.error}
          </Notice>
        )}

        {state?.ok && (
          <Notice
            tone="ok"
            title={`Lien créé${
              state.notified ? " et praticien prévenu par email" : ""
            }, valable jusqu'à ${new Intl.DateTimeFormat("fr-FR", {
              timeStyle: "short",
              timeZone: "Europe/Paris",
            }).format(new Date(state.expiresAt))}`}
          >
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 overflow-x-auto rounded-md border border-border bg-card px-2.5 py-2 font-mono text-xs">
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
            <p className="mt-2 text-xs leading-relaxed">
              Transmettez-le par un canal immédiat (téléphone, message). Il ne
              sera plus affiché après avoir quitté cette page.
            </p>
          </Notice>
        )}
      </CardContent>

      {/* Barre d'action ancrée en pied de carte : la soumission a un domicile,
          et le bas de la carte cesse d'être un bord flottant. */}
      <FormActions>
        <label className="flex items-center gap-2.5 text-xs text-muted-foreground">
          <Checkbox name="notify" />
          Prévenir le praticien par email (le message ne contient pas le lien)
        </label>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Création du lien…" : "Créer le lien de souscription"}
        </Button>
      </FormActions>
    </form>
  );
}
