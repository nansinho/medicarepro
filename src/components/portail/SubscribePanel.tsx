"use client";

import { useMemo, useState } from "react";
import MoneticoRedirectForm from "@/components/checkout/MoneticoRedirectForm";
import { LEGAL_DOCUMENTS, TERMS_LABEL } from "@/lib/legal/registry";
import {
  MAX_EXTRA_COLLABORATORS,
  checkoutAmountCents,
  instalmentAmountsCents,
  instalmentsAvailable,
  formatEuros,
} from "@/lib/checkout/pricing";
import PdfViewer, { type PdfDoc } from "@/components/checkout/PdfViewer";
import pdfStyles from "@/components/checkout/PdfViewer.module.css";
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

/* Repris de la grille tarifaire, jamais recopié : c'est cette valeur que le
   serveur applique. */
const MAX_COLLABS = MAX_EXTRA_COLLABORATORS;

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
  /** Document contractuel en cours de lecture. */
  const [pdf, setPdf] = useState<PdfDoc | null>(null);
  const [plan, setPlan] = useState<"MONTHLY" | "ANNUAL">(
    monthlyEnabled ? "MONTHLY" : "ANNUAL",
  );
  const [extra, setExtra] = useState(0);
  /* Règlement en trois fois. Un cabinet déjà installé qui régularise sa
     facturation paie l'année entière d'un coup : c'est ici que la somme est la
     plus lourde, donc ici que l'étalement sert le plus. */
  const [instalments, setInstalments] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirect, setRedirect] = useState<Redirect | null>(null);

  const row = useMemo(() => prices[plan][extra], [prices, plan, extra]);
  /* Le même découpage que le serveur, au centime près : le reste de la division
     tombe sur le premier versement. Ce n'est qu'un affichage — les montants
     facturés sont recalculés côté serveur — mais un écart d'un centime entre
     l'écran et le débit est ce qui fait écrire un praticien. */
  const echelonnable = instalmentsAvailable(plan);
  const versements = useMemo(
    () =>
      echelonnable && instalments
        ? instalmentAmountsCents(checkoutAmountCents(plan, extra))
        : [],
    [echelonnable, instalments, plan, extra],
  );

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
        body: JSON.stringify({
          plan,
          extraCollaborators: extra,
          instalments: echelonnable && instalments,
        }),
      });
      if (res.ok) {
        const reponse = (await res.json()) as Redirect & { url?: string };
        /* Stripe renvoie une adresse : on y va, la page de paiement est chez
           eux. Monetico renvoie un formulaire scellé, qui doit être soumis en
           POST — d'où le composant dédié. On distingue par la forme de la
           réponse plutôt que par une variable, pour que le navigateur n'ait
           aucune décision de configuration à prendre. */
        if (reponse.url) {
          window.location.assign(reponse.url);
          return;
        }
        setRedirect(reponse);
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
      {pdf && <PdfViewer doc={pdf} onClose={() => setPdf(null)} />}

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
            <input
              type="number"
              inputMode="numeric"
              className={s.counterVal}
              value={extra}
              min={0}
              max={MAX_COLLABS}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                if (Number.isNaN(n)) return setExtra(0);
                setExtra(Math.max(0, Math.min(MAX_COLLABS, n)));
              }}
              aria-label="Nombre de collaborateurs supplémentaires"
            />
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

        {/* ---- Règlement en trois fois — offre 12 mois uniquement ----
            Le mensuel est déjà un étalement : le redécouper n'aurait pas de
            sens. Le calendrier est écrit en clair, montants et échéances
            comprises : un praticien qui découvre un second prélèvement un mois
            plus tard conteste auprès de sa banque, et une contestation coûte
            plus cher que le versement. */}
        {echelonnable && (
          <div className={s.instalmentBox}>
            <label className={s.instalmentToggle}>
              <input
                type="checkbox"
                checked={instalments}
                onChange={(e) => setInstalments(e.target.checked)}
              />
              <span>
                <b>Régler en 3 fois, sans frais</b>
                <span className={s.instalmentHint}>
                  Trois versements mensuels au lieu d&apos;un paiement unique.
                  Rien ne change pour votre cabinet, l&apos;accès reste ouvert
                  douze mois dès le premier.
                </span>
              </span>
            </label>
            {versements.length > 0 && (
              <ol className={s.instalmentPlan}>
                {versements.map((montant, i) => (
                  <li key={i}>
                    <span>{i === 0 ? "Aujourd'hui" : `Dans ${i} mois`}</span>
                    <b>{formatEuros(montant)} TTC</b>
                  </li>
                ))}
                <li className={s.instalmentTotal}>
                  <span>Total, sans supplément</span>
                  <b>{row.totalLabel} TTC</b>
                </li>
              </ol>
            )}
          </div>
        )}

        <div className={s.recap}>
          <span className={s.recapLabel}>Payé aujourd&apos;hui</span>
          <span className={s.recapValue}>
            {versements.length > 0
              ? `${formatEuros(versements[0])} TTC (1er des ${versements.length} versements)`
              : `${row.totalLabel} TTC ${plan === "ANNUAL" ? "(12 mois)" : "(1er mois)"}`}
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
              <button
                type="button"
                className={pdfStyles.trigger}
                onClick={() =>
                  setPdf({
                    title: doc.title,
                    version: doc.version,
                    href: doc.pdfHref,
                  })
                }
                aria-label={`Lire le PDF officiel : ${doc.title} (version ${doc.version})`}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6zm7 1.5L18.5 9H14a1 1 0 0 1-1-1V3.5z" />
                </svg>
                PDF
              </button>
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
              /* LE BOUTON ANNONCE CE QUI VA ÊTRE DÉBITÉ, pas le prix de
                 l'offre : sur un règlement échelonné les deux diffèrent, et
                 c'est le bouton qu'on lit. */
              `Payer ${versements.length > 0 ? formatEuros(versements[0]) : row.totalLabel} et activer mon abonnement`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
