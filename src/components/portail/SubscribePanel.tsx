"use client";

import { useMemo, useState } from "react";
import MoneticoRedirectForm from "@/components/checkout/MoneticoRedirectForm";
import { LEGAL_DOCUMENTS, TERMS_LABEL } from "@/lib/legal/registry";
import s from "./Portal.module.css";

/* ============================================================
   Souscription d'un cabinet DÉJÀ EXISTANT.

   Écrit d'abord avec les styles du tunnel de vente, c'était le seul écran du
   parcours resté dans l'ancien langage visuel : le praticien passait d'un
   espace abonnement à un formulaire d'un autre site. Il emprunte désormais le
   même vocabulaire que le reste du portail (Portal.module.css), sans une ligne
   de CSS nouvelle — donc sans troisième style à maintenir.

   Ce qu'on ne lui demande pas : ni compte, ni mot de passe, ni coordonnées. Le
   cabinet travaille dans le logiciel depuis longtemps ; on ne redemande que ce
   qu'on ne peut pas deviner, sa formule et son nombre de collaborateurs.

   Les prix sont calculés PAR LE SERVEUR et passés en props : le navigateur
   n'embarque aucune logique tarifaire, il affiche.
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
    <div className={s.panel}>
      <div className={s.panelHead}>
        <span className={s.panelTitle}>Choisissez votre formule</span>
        <span className={s.panelNote}>Modifiable à tout moment ensuite</span>
      </div>

      <div className={s.panelBody}>
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
            <div className={s.planCardTop}>
              {annualEnabled && <span className={s.planCardBadge}>2 mois offerts</span>}
            </div>
            <div className={s.planCardName}>Offre 12 mois</div>
            <div className={s.planCardPrice}>
              {prices.ANNUAL[extra].monthlyLabel}
              <span className={s.planPriceUnit}> TTC/mois</span>
            </div>
            <div className={s.planCardDesc}>
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
            <div className={s.planCardTop} />
            <div className={s.planCardName}>Mensuel sans engagement</div>
            <div className={s.planCardPrice}>
              {prices.MONTHLY[extra].monthlyLabel}
              <span className={s.planPriceUnit}> TTC/mois</span>
            </div>
            <div className={s.planCardDesc}>
              {monthlyEnabled
                ? "Reconduit chaque mois, résiliable à tout moment."
                : "Cette formule ouvrira prochainement."}
            </div>
          </button>
        </div>

        <div className={s.collab}>
          <div>
            <div className={s.collabLabel}>Collaborateurs supplémentaires</div>
            <div className={s.collabHint}>
              Praticiens en plus du titulaire, 15,00&nbsp;€ TTC/mois chacun.
            </div>
          </div>
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
        </div>

        <div className={s.recap}>
          <span className={s.recapLabel}>Payé aujourd&apos;hui</span>
          <span className={s.recapValue}>
            {row.totalLabel} TTC {plan === "ANNUAL" ? "(12 mois)" : "(1er mois)"}
          </span>
        </div>

        <div className={s.notice}>
          <span className={s.noticeAccent} aria-hidden="true" />
          <div className={s.noticeBody}>
            <div className={s.noticeText}>
              {/* `{" "}` explicite : l'espace écrit après </b> est supprimé à la
                  compilation, et le nom du cabinet se collait au mot suivant. */}
              Votre cabinet <b>{cabinetName}</b>{" "}
              et vos dossiers patients restent exactement en l&apos;état :
              souscrire n&apos;ouvre pas un nouveau compte, cela met en place la
              facturation de celui que vous utilisez déjà.{" "}
              {plan === "MONTHLY"
                ? "Le paiement est reconduit chaque mois par carte."
                : "Le paiement est unique et couvre douze mois."}
            </div>
          </div>
        </div>

        {/* Documents contractuels et case unique NON pré-cochée. Le libellé
            affiché est EXACTEMENT celui archivé dans la preuve de consentement
            (art. 5 CGV v2.1) : le reformuler invaliderait la preuve. */}
        <ul className={s.docList}>
          {Object.values(LEGAL_DOCUMENTS).map((doc) => (
            <li key={doc.key} className={s.docItem}>
              <div>
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

        {error && <p className={s.error}>{error}</p>}

        <div className={s.actions}>
          <button
            type="button"
            /* `btnPrimary` ne porte que la couleur : la géométrie du bouton
               (taille, rayon, état désactivé) vient de `btn`. Seule, elle
               donnait un rectangle sombre collé au texte. */
            className={`${s.btn} ${s.btnPrimary}`}
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
      </div>
    </div>
  );
}
