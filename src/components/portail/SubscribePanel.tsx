"use client";

import { useMemo, useState } from "react";
import MoneticoRedirectForm from "@/components/checkout/MoneticoRedirectForm";
import { LEGAL_DOCUMENTS, TERMS_LABEL } from "@/lib/legal/registry";
import s from "@/components/checkout/Checkout.module.css";

/* ============================================================
   Souscription d'un cabinet DÉJÀ EXISTANT.

   Différence essentielle avec le tunnel de vente : il n'y a ni compte à
   créer, ni mot de passe, ni coordonnées à saisir. Le cabinet travaille dans
   le logiciel depuis longtemps ; on ne lui redemande que ce qu'on ne peut pas
   deviner — sa formule et son nombre de collaborateurs.

   Les prix affichés sont calculés PAR LE SERVEUR et passés en props : le
   navigateur ne recalcule jamais un montant, il ne fait que l'afficher.
   ============================================================ */

type PriceRow = { monthlyLabel: string; totalLabel: string };
type Prices = { MONTHLY: PriceRow[]; ANNUAL: PriceRow[] };
type Redirect = { action: string; fields: Record<string, string> };

const MAX_COLLABS = 20;

export default function SubscribePanel({
  prices,
  monthlyEnabled,
  annualEnabled,
  cabinetName,
}: {
  prices: Prices;
  monthlyEnabled: boolean;
  annualEnabled: boolean;
  cabinetName: string;
}) {
  const [plan, setPlan] = useState<"MONTHLY" | "ANNUAL">(
    monthlyEnabled ? "MONTHLY" : "ANNUAL",
  );
  const [extra, setExtra] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirect, setRedirect] = useState<Redirect | null>(null);

  const row = useMemo(() => prices[plan][extra], [prices, plan, extra]);

  if (redirect) {
    return <MoneticoRedirectForm action={redirect.action} fields={redirect.fields} />;
  }

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/subscribe", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, extraCollaborators: extra }),
      });
      if (res.ok) {
        setRedirect((await res.json()) as Redirect);
        return;
      }
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(
        body?.error ??
          "La souscription est momentanément indisponible. Écrivez-nous à contact@medicarepro.fr.",
      );
    } catch {
      setError("Impossible de contacter le serveur. Vérifiez votre connexion.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.sectionGap}>
      {error && (
        <div className={s.banner} role="alert">
          <span>{error}</span>
        </div>
      )}

      <div className={s.planGrid}>
        <button
          type="button"
          className={`${s.planCard} ${plan === "ANNUAL" ? s.planCardActive : ""} ${
            !annualEnabled ? s.planCardDisabled : ""
          }`}
          onClick={() => annualEnabled && setPlan("ANNUAL")}
          disabled={!annualEnabled}
          aria-pressed={plan === "ANNUAL"}
        >
          {annualEnabled ? (
            <span className={s.planBadge}>2 mois offerts</span>
          ) : (
            <span className={s.planSoon}>Bientôt disponible</span>
          )}
          <div className={s.planName}>Offre 12 mois</div>
          <div className={s.planPrice}>
            {prices.ANNUAL[extra].monthlyLabel}
            <span className={s.planPriceUnit}> TTC/mois</span>
          </div>
          <div className={s.planDesc}>
            {annualEnabled
              ? `Facturé ${prices.ANNUAL[extra].totalLabel} par an, en une fois.`
              : "Cette formule ouvrira prochainement."}
          </div>
        </button>

        <button
          type="button"
          className={`${s.planCard} ${plan === "MONTHLY" ? s.planCardActive : ""} ${
            !monthlyEnabled ? s.planCardDisabled : ""
          }`}
          onClick={() => monthlyEnabled && setPlan("MONTHLY")}
          disabled={!monthlyEnabled}
          aria-pressed={plan === "MONTHLY"}
        >
          {!monthlyEnabled && <span className={s.planSoon}>Bientôt disponible</span>}
          <div className={s.planName}>Mensuel sans engagement</div>
          <div className={s.planPrice}>
            {prices.MONTHLY[extra].monthlyLabel}
            <span className={s.planPriceUnit}> TTC/mois</span>
          </div>
          <div className={s.planDesc}>
            {monthlyEnabled
              ? "Sans engagement, résiliable à tout moment."
              : "Cette formule ouvrira prochainement."}
          </div>
        </button>
      </div>

      <div className={s.collab}>
        <div className={s.collabHead}>Collaborateurs supplémentaires</div>
        <p className={s.collabDesc}>
          Praticiens en plus du titulaire — 15,00&nbsp;€ TTC/mois chacun.
        </p>
        <div className={s.counter}>
          <button
            type="button"
            className={s.counterBtn}
            onClick={() => setExtra((v) => Math.max(0, v - 1))}
            disabled={extra === 0}
            aria-label="Retirer un collaborateur"
          >
            −
          </button>
          <span className={s.counterVal} aria-live="polite">
            {extra}
          </span>
          <button
            type="button"
            className={s.counterBtn}
            onClick={() => setExtra((v) => Math.min(MAX_COLLABS, v + 1))}
            disabled={extra === MAX_COLLABS}
            aria-label="Ajouter un collaborateur"
          >
            +
          </button>
        </div>
        <div className={s.collabCalc}>
          <span>
            Mensualité&nbsp;: <span className={s.accent}>{row.monthlyLabel} TTC/mois</span>
          </span>
          <span className={s.collabTotal}>
            Payé aujourd&apos;hui&nbsp;: {row.totalLabel} TTC{" "}
            {plan === "ANNUAL" ? "(12 mois)" : "(1er mois)"}
          </span>
        </div>
      </div>

      <div className={s.alert}>
        <span>
          Votre cabinet <b>{cabinetName}</b> et vos dossiers patients restent
          exactement en l&apos;état&nbsp;: souscrire n&apos;ouvre pas un nouveau
          compte, cela met en place la facturation du compte que vous utilisez
          déjà.{" "}
          {plan === "MONTHLY"
            ? "Le paiement est reconduit chaque mois par carte, résiliable à tout moment."
            : "Le paiement est unique et couvre 12 mois, sans reconduction automatique."}
        </span>
      </div>

      {/* Documents contractuels + case unique NON pré-cochée. Le libellé
          affiché est EXACTEMENT celui archivé dans la preuve de consentement
          (art. 5 CGV v2.1) : le reformuler ici invaliderait la preuve. */}
      <ul className={s.docList}>
        {Object.values(LEGAL_DOCUMENTS).map((doc) => (
          <li key={doc.key} className={s.docItem}>
            <div className={s.docMain}>
              <a
                className={s.docTitle}
                href={doc.pageHref}
                target="_blank"
                rel="noreferrer"
              >
                {doc.title}
              </a>
              <span className={s.docMeta}>Version {doc.version}</span>
            </div>
            <a
              className={s.docPdf}
              href={doc.pdfHref}
              target="_blank"
              rel="noreferrer"
            >
              PDF
            </a>
          </li>
        ))}
      </ul>

      <label className={s.checkRow}>
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
        />
        <span>{TERMS_LABEL}</span>
      </label>

      <button
        type="button"
        className={s.btnPrimary}
        onClick={pay}
        disabled={busy || !accepted}
      >
        {busy ? (
          <>
            <span className={s.spinner} aria-hidden="true" />
            Préparation du paiement…
          </>
        ) : (
          `Payer ${row.totalLabel} et activer mon abonnement`
        )}
      </button>
    </div>
  );
}
