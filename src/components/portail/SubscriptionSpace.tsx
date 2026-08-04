"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MoneticoRedirectForm from "@/components/checkout/MoneticoRedirectForm";
import { LEGAL_DOCUMENTS, TERMS_LABEL } from "@/lib/legal/registry";
import s from "./Portal.module.css";

/* ============================================================
   Espace abonnement : état du contrat et actions du praticien.

   CE QUE CE COMPOSANT NE FAIT JAMAIS : calculer un prix, décider si une action
   est permise, ou supposer l'effet d'un clic. Tout vient du serveur, y compris
   les libellés de dates et de montants. Le navigateur affiche et demande, il
   ne tranche pas.

   PARTI PRIS D'INTERFACE : chaque action se déplie en pleine largeur sous le
   bouton qui l'a demandée, jamais dans une fenêtre flottante. On y annonce
   d'abord ce qui va se passer (et ce qui est irréversible), le bouton
   d'engagement vient en dernier.
   ============================================================ */

export type PortalPlan = "MONTHLY" | "ANNUAL";
type PriceRow = { monthlyLabel: string; totalLabel: string };

export type PortalChange = {
  kind: "plan_change" | "card_update" | "cancel";
  targetPlan: PortalPlan | null;
  targetExtra: number | null;
  targetLabel: string | null;
  targetAmountLabel: string | null;
  effectiveAtLabel: string;
  payableNow: boolean;
  payableFromLabel: string | null;
};

export type PortalInvoice = {
  id: string;
  number: string;
  issuedAtLabel: string;
  amountLabel: string;
  kindLabel: string;
};

export type SubscriptionSpaceProps = {
  cabinetName: string;
  plan: PortalPlan;
  extraCollaborators: number;
  planLabelText: string;
  renewalAmountLabel: string;
  status: string;
  periodEndLabel: string;
  /** La période payée court-elle encore ? */
  periodRunning: boolean;
  recurrenceStopped: boolean;
  graceUntilLabel: string | null;
  change: PortalChange | null;
  prices: { MONTHLY: PriceRow[]; ANNUAL: PriceRow[] };
  monthlyEnabled: boolean;
  annualEnabled: boolean;
  /** L'encaissement en ligne est-il ouvert ? */
  checkoutOpen: boolean;
  /** Une reprise/un renouvellement est-il payable dès maintenant ? */
  resumePayable: boolean;
  invoices: PortalInvoice[];
  billing: {
    adminName: string;
    adminEmail: string;
    address: string;
    postalCity: string;
    invoicePrefix: string;
  };
};

const MAX_COLLABS = 20;
type Drawer = "plan" | "card" | "cancel" | "pay" | null;
type Redirect = { action: string; fields: Record<string, string> };

const CONTACT = (
  <a href="mailto:contact@medicarepro.fr">contact@medicarepro.fr</a>
);

/** Avertissement commun à toute demande : l'arrêt bancaire ne se rejoue pas. */
function IrreversibleWarning({ effectiveAtLabel }: { effectiveAtLabel: string }) {
  return (
    <div className={s.warnBox}>
      <svg
        className={s.warnIcon}
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        <path d="M12 9v4M12 17h.01" />
      </svg>
      <div className={s.warnText}>
        <strong>Votre reconduction automatique sera arrêtée.</strong>{" "}
        Votre banque ne sait pas modifier un prélèvement déjà programmé, et cet
        arrêt est définitif. Vous gardez l&apos;accès complet jusqu&apos;au{" "}
        {effectiveAtLabel}, puis vous validerez un paiement depuis cette page
        pour repartir. Nous vous préviendrons par email une semaine avant, puis
        la veille.
      </div>
    </div>
  );
}

export default function SubscriptionSpace(props: SubscriptionSpaceProps) {
  const router = useRouter();
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirect, setRedirect] = useState<Redirect | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  /* Le panneau s'ouvre sous la grille : sur un écran court, il naîtrait hors
     champ et le clic semblerait sans effet. On l'amène à l'écran. */
  useEffect(() => {
    if (drawer) {
      drawerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [drawer]);

  // Formulaire « changer de formule ».
  const [plan, setPlan] = useState<PortalPlan>(props.plan);
  const [extra, setExtra] = useState(props.extraCollaborators);
  // Formulaire « résilier ».
  const [reason, setReason] = useState("");
  // Paiement.
  const [accepted, setAccepted] = useState(false);

  if (redirect) {
    return (
      <div className={s.space}>
        <MoneticoRedirectForm action={redirect.action} fields={redirect.fields} />
      </div>
    );
  }

  const { change } = props;
  const inArrears = props.status === "past_due" || props.status === "suspended";
  const selectedRow = props.prices[plan][Math.min(extra, MAX_COLLABS)];
  const planUnchanged =
    plan === props.plan && extra === props.extraCollaborators;

  /* La formule que le paiement en cours va engager. Après une demande, c'est
     la cible ; sinon c'est ce que le praticien vient de choisir pour reprendre. */
  const payPlan: PortalPlan = change?.targetPlan ?? (change ? props.plan : plan);
  const payExtra =
    change?.targetExtra ?? (change ? props.extraCollaborators : extra);
  const payRow = props.prices[payPlan][Math.min(payExtra, MAX_COLLABS)];

  function openDrawer(next: Drawer) {
    setError(null);
    setAccepted(false);
    if (next === "plan") {
      setPlan(props.plan);
      setExtra(props.extraCollaborators);
    }
    setDrawer((current) => (current === next ? null : next));
  }

  async function post(url: string, body: unknown): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        if (url.endsWith("/pay")) {
          setRedirect((await res.json()) as Redirect);
        }
        return true;
      }
      const payload = (await res.json().catch(() => null)) as {
        error?: string;
        expired?: boolean;
      } | null;
      if (payload?.expired) {
        /* Session close : la page servira elle-même le mode d'emploi pour
           rouvrir l'espace depuis le logiciel. */
        router.refresh();
        return false;
      }
      setError(
        payload?.error ??
          "L'opération n'a pas abouti. Réessayez, ou écrivez-nous à contact@medicarepro.fr.",
      );
      return false;
    } catch {
      setError("Impossible de contacter le serveur. Vérifiez votre connexion.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submitChange(body: Record<string, unknown>) {
    const ok = await post("/api/portal/change", body);
    if (ok) {
      setDrawer(null);
      router.refresh();
    }
  }

  /* ---------- Bandeau principal ---------- */

  function renderStatusNotice() {
    if (inArrears) {
      return (
        <div className={`${s.notice} ${s.noticeDanger}`} role="alert">
          <span className={s.noticeAccent} aria-hidden="true" />
          <div className={s.noticeBody}>
            <div className={s.noticeTitle}>
              Votre dernier paiement a été refusé
            </div>
            <p className={s.noticeText}>
              Votre accès reste entier
              {props.graceUntilLabel
                ? ` jusqu'au ${props.graceUntilLabel}`
                : ""}
              . Réglez l&apos;échéance avec une autre carte pour que tout
              reparte normalement.
            </p>
            <div className={s.noticeActions}>
              {change && change.payableNow ? (
                <button
                  type="button"
                  className={`${s.btn} ${s.btnPrimary}`}
                  onClick={() => openDrawer("pay")}
                >
                  Régler {change.targetAmountLabel ?? props.renewalAmountLabel}{" "}
                  maintenant
                </button>
              ) : (
                <button
                  type="button"
                  className={`${s.btn} ${s.btnPrimary}`}
                  onClick={() => openDrawer("card")}
                  disabled={!props.checkoutOpen}
                >
                  Payer avec une autre carte
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (change && change.kind === "cancel") {
      return (
        <div className={`${s.notice} ${s.noticeWarn}`}>
          <span className={s.noticeAccent} aria-hidden="true" />
          <div className={s.noticeBody}>
            <div className={s.noticeTitle}>
              Votre abonnement prend fin le {change.effectiveAtLabel}
            </div>
            <p className={s.noticeText}>
              Vous gardez l&apos;accès complet jusque-là, et plus aucun montant
              ne sera prélevé. Vos données restent conservées&nbsp;: vous pouvez
              revenir sur cette décision à tout moment.
            </p>
            <div className={s.noticeActions}>
              <button
                type="button"
                className={`${s.btn} ${s.btnGhost}`}
                onClick={() => submitChange({ action: "withdraw" })}
                disabled={busy}
              >
                {busy ? "…" : "Annuler ma résiliation"}
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (change) {
      const isCard = change.kind === "card_update";
      return (
        <div className={`${s.notice} ${change.payableNow ? "" : s.noticeWarn}`}>
          <span className={s.noticeAccent} aria-hidden="true" />
          <div className={s.noticeBody}>
            <div className={s.noticeTitle}>
              {change.payableNow
                ? isCard
                  ? "Votre nouvelle carte est à enregistrer"
                  : "Votre nouvelle formule est à valider"
                : isCard
                  ? `Changement de carte prévu le ${change.effectiveAtLabel}`
                  : `Nouvelle formule prévue le ${change.effectiveAtLabel}`}
            </div>
            <p className={s.noticeText}>
              {change.payableNow ? (
                <>
                  Un paiement de{" "}
                  <strong>{change.targetAmountLabel ?? payRow.totalLabel}</strong>{" "}
                  valide {isCard ? "votre nouvelle carte" : "le changement"} et
                  relance la reconduction automatique.
                </>
              ) : (
                <>
                  {isCard ? "Votre nouvelle carte" : change.targetLabel} prendra
                  effet le <strong>{change.effectiveAtLabel}</strong>, à la fin
                  de la période que vous avez déjà réglée. D&apos;ici là rien ne
                  change et aucun montant ne sera débité.
                </>
              )}
            </p>
            <div className={s.noticeActions}>
              {change.payableNow && (
                <button
                  type="button"
                  className={`${s.btn} ${s.btnPrimary}`}
                  onClick={() => openDrawer("pay")}
                  disabled={!props.checkoutOpen}
                >
                  Valider et payer{" "}
                  {change.targetAmountLabel ?? payRow.totalLabel}
                </button>
              )}
              <button
                type="button"
                className={`${s.btn} ${s.btnQuiet}`}
                onClick={() => submitChange({ action: "withdraw" })}
                disabled={busy}
              >
                {busy ? "…" : "Annuler cette demande"}
              </button>
            </div>
          </div>
        </div>
      );
    }

    /* Aucune demande, mais plus de reconduction : annuel arrivant à terme, ou
       mensuel dont la récurrence a été arrêtée. Le praticien doit savoir que
       rien ne repartira tout seul. */
    if (props.recurrenceStopped) {
      return (
        <div className={`${s.notice} ${props.resumePayable ? s.noticeWarn : ""}`}>
          <span className={s.noticeAccent} aria-hidden="true" />
          <div className={s.noticeBody}>
            <div className={s.noticeTitle}>
              {props.plan === "ANNUAL"
                ? `Votre accès est réglé jusqu'au ${props.periodEndLabel}`
                : `Votre abonnement ne se reconduit plus`}
            </div>
            <p className={s.noticeText}>
              {props.plan === "ANNUAL"
                ? "L'offre 12 mois est un paiement unique, sans reconduction automatique. Renouvelez quand vous le souhaitez : la nouvelle période s'ajoute à celle en cours, vous ne perdez aucun jour."
                : `Votre accès reste entier jusqu'au ${props.periodEndLabel}. Pour continuer ensuite, validez un paiement à partir de cette date.`}
            </p>
            <div className={s.noticeActions}>
              <button
                type="button"
                className={`${s.btn} ${props.resumePayable ? s.btnPrimary : s.btnGhost}`}
                onClick={() => openDrawer("pay")}
                disabled={!props.checkoutOpen || !props.resumePayable}
              >
                {props.plan === "ANNUAL"
                  ? "Renouveler mon abonnement"
                  : props.resumePayable
                    ? "Reprendre mon abonnement"
                    : `Reprise possible le ${props.periodEndLabel}`}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return null;
  }

  /* ---------- Panneaux ---------- */

  function renderPlanDrawer() {
    return (
      <div className={s.drawer}>
        <div className={s.drawerHead}>
          <div className={s.drawerTitle}>Changer de formule</div>
          <p className={s.drawerLead}>
            Choisissez ce que vous voulez à partir du {props.periodEndLabel}.
            Rien n&apos;est débité aujourd&apos;hui.
          </p>
        </div>
        <div className={s.drawerBody}>
          <div className={s.planGrid}>
            <button
              type="button"
              className={`${s.planCard} ${plan === "ANNUAL" ? s.planCardActive : ""} ${
                !props.annualEnabled ? s.planCardDisabled : ""
              }`}
              onClick={() => props.annualEnabled && setPlan("ANNUAL")}
              disabled={!props.annualEnabled}
              aria-pressed={plan === "ANNUAL"}
            >
              <div className={s.planCardTop}>
                {props.plan === "ANNUAL" ? (
                  <span className={s.planCardCurrent}>Formule actuelle</span>
                ) : (
                  props.annualEnabled && (
                    <span className={s.planCardBadge}>2 mois offerts</span>
                  )
                )}
              </div>
              <div className={s.planCardName}>Offre 12 mois</div>
              <div className={s.planCardPrice}>
                {props.prices.ANNUAL[extra].monthlyLabel}
                <span className={s.planPriceUnit}> TTC/mois</span>
              </div>
              <div className={s.planCardDesc}>
                {props.annualEnabled
                  ? `Facturé ${props.prices.ANNUAL[extra].totalLabel} par an, en une fois.`
                  : "Cette formule ouvrira prochainement."}
              </div>
            </button>

            <button
              type="button"
              className={`${s.planCard} ${plan === "MONTHLY" ? s.planCardActive : ""} ${
                !props.monthlyEnabled ? s.planCardDisabled : ""
              }`}
              onClick={() => props.monthlyEnabled && setPlan("MONTHLY")}
              disabled={!props.monthlyEnabled}
              aria-pressed={plan === "MONTHLY"}
            >
              <div className={s.planCardTop}>
                {props.plan === "MONTHLY" && (
                  <span className={s.planCardCurrent}>Formule actuelle</span>
                )}
              </div>
              <div className={s.planCardName}>Mensuel sans engagement</div>
              <div className={s.planCardPrice}>
                {props.prices.MONTHLY[extra].monthlyLabel}
                <span className={s.planPriceUnit}> TTC/mois</span>
              </div>
              <div className={s.planCardDesc}>
                {props.monthlyEnabled
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
            <span className={s.recapLabel}>
              À régler le {props.periodEndLabel}
            </span>
            <span className={s.recapValue}>
              {selectedRow.totalLabel} TTC{" "}
              {plan === "ANNUAL" ? "(12 mois)" : "(1 mois)"}
            </span>
          </div>

          <IrreversibleWarning effectiveAtLabel={props.periodEndLabel} />

          {error && <div className={s.error}>{error}</div>}

          <div className={s.actions} style={{ marginTop: 0, borderTop: 0, paddingTop: 0 }}>
            <button
              type="button"
              className={`${s.btn} ${s.btnPrimary}`}
              onClick={() =>
                submitChange({
                  action: "plan",
                  plan,
                  extraCollaborators: extra,
                })
              }
              disabled={busy || planUnchanged}
            >
              {busy ? (
                <>
                  <span className={s.spinner} aria-hidden="true" />
                  Enregistrement…
                </>
              ) : planUnchanged ? (
                "C'est déjà votre formule"
              ) : (
                "Enregistrer ce changement"
              )}
            </button>
            <button
              type="button"
              className={`${s.btn} ${s.btnQuiet}`}
              onClick={() => setDrawer(null)}
              disabled={busy}
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderCardDrawer() {
    return (
      <div className={s.drawer}>
        <div className={s.drawerHead}>
          <div className={s.drawerTitle}>Changer de carte</div>
          <p className={s.drawerLead}>
            {inArrears
              ? "Votre échéance est due : la nouvelle carte la règle immédiatement et la reconduction repart."
              : `Votre formule ne change pas. Vous enregistrerez votre nouvelle carte le ${props.periodEndLabel}, en réglant l'échéance.`}
          </p>
        </div>
        <div className={s.drawerBody}>
          <div className={s.recap}>
            <span className={s.recapLabel}>
              {inArrears ? "À régler maintenant" : `À régler le ${props.periodEndLabel}`}
            </span>
            <span className={s.recapValue}>
              {props.renewalAmountLabel} TTC
            </span>
          </div>

          {!inArrears && (
            <IrreversibleWarning effectiveAtLabel={props.periodEndLabel} />
          )}

          {error && <div className={s.error}>{error}</div>}

          <div className={s.actions} style={{ marginTop: 0, borderTop: 0, paddingTop: 0 }}>
            <button
              type="button"
              className={`${s.btn} ${s.btnPrimary}`}
              onClick={() => submitChange({ action: "card" })}
              disabled={busy}
            >
              {busy ? (
                <>
                  <span className={s.spinner} aria-hidden="true" />
                  Enregistrement…
                </>
              ) : inArrears ? (
                "Continuer vers le paiement"
              ) : (
                "Enregistrer ma demande"
              )}
            </button>
            <button
              type="button"
              className={`${s.btn} ${s.btnQuiet}`}
              onClick={() => setDrawer(null)}
              disabled={busy}
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderCancelDrawer() {
    return (
      <div className={s.drawer}>
        <div className={s.drawerHead}>
          <div className={s.drawerTitle}>Résilier mon abonnement</div>
          <p className={s.drawerLead}>
            Votre accès reste entier jusqu&apos;au {props.periodEndLabel}, la
            période que vous avez déjà réglée. Aucun nouveau montant ne sera
            prélevé.
          </p>
        </div>
        <div className={s.drawerBody}>
          <div className={s.warnBox}>
            <svg
              className={s.warnIcon}
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              <path d="M12 9v4M12 17h.01" />
            </svg>
            <div className={s.warnText}>
              <strong>Pensez à vos exports avant le {props.periodEndLabel}.</strong>{" "}
              Vos dossiers patients restent conservés après cette date, mais
              l&apos;accès au logiciel sera fermé. Vous pouvez reprendre un
              abonnement à tout moment et tout retrouver en l&apos;état.
            </div>
          </div>

          <label className={s.field}>
            <span className={s.fieldLabel}>
              Ce qui vous a manqué (facultatif)
            </span>
            <textarea
              className={s.textarea}
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 2000))}
              placeholder="Une fonction absente, un tarif, un changement d'organisation… Votre retour nous sert vraiment."
            />
          </label>

          {error && <div className={s.error}>{error}</div>}

          <div className={s.actions} style={{ marginTop: 0, borderTop: 0, paddingTop: 0 }}>
            <button
              type="button"
              className={`${s.btn} ${s.btnDanger}`}
              onClick={() => submitChange({ action: "cancel", reason })}
              disabled={busy}
            >
              {busy ? "Enregistrement…" : `Résilier au ${props.periodEndLabel}`}
            </button>
            <button
              type="button"
              className={`${s.btn} ${s.btnQuiet}`}
              onClick={() => setDrawer(null)}
              disabled={busy}
            >
              Je garde mon abonnement
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderPayDrawer() {
    const isResume = !change;
    const title = change
      ? change.kind === "card_update"
        ? "Enregistrer ma nouvelle carte"
        : "Valider ma nouvelle formule"
      : props.plan === "ANNUAL"
        ? "Renouveler mon abonnement"
        : "Reprendre mon abonnement";

    return (
      <div className={s.drawer}>
        <div className={s.drawerHead}>
          <div className={s.drawerTitle}>{title}</div>
          <p className={s.drawerLead}>
            {change?.kind === "card_update"
              ? "Vous serez redirigé vers la page sécurisée de votre banque. La carte que vous y saisirez remplace l'ancienne pour les prochaines échéances."
              : payPlan === "MONTHLY"
                ? "Paiement par carte, reconduit ensuite chaque mois automatiquement. Résiliable à tout moment depuis cette page."
                : "Paiement unique couvrant 12 mois, sans reconduction automatique."}
          </p>
        </div>
        <div className={s.drawerBody}>
          {isResume && props.plan !== "ANNUAL" && (
            <div className={s.planGrid}>
              <button
                type="button"
                className={`${s.planCard} ${plan === "ANNUAL" ? s.planCardActive : ""} ${
                  !props.annualEnabled ? s.planCardDisabled : ""
                }`}
                onClick={() => props.annualEnabled && setPlan("ANNUAL")}
                disabled={!props.annualEnabled}
                aria-pressed={plan === "ANNUAL"}
              >
                <div className={s.planCardName}>Offre 12 mois</div>
                <div className={s.planCardPrice}>
                  {props.prices.ANNUAL[extra].monthlyLabel}
                  <span className={s.planPriceUnit}> TTC/mois</span>
                </div>
                <div className={s.planCardDesc}>
                  Facturé {props.prices.ANNUAL[extra].totalLabel} par an.
                </div>
              </button>
              <button
                type="button"
                className={`${s.planCard} ${plan === "MONTHLY" ? s.planCardActive : ""} ${
                  !props.monthlyEnabled ? s.planCardDisabled : ""
                }`}
                onClick={() => props.monthlyEnabled && setPlan("MONTHLY")}
                disabled={!props.monthlyEnabled}
                aria-pressed={plan === "MONTHLY"}
              >
                <div className={s.planCardName}>Mensuel</div>
                <div className={s.planCardPrice}>
                  {props.prices.MONTHLY[extra].monthlyLabel}
                  <span className={s.planPriceUnit}> TTC/mois</span>
                </div>
                <div className={s.planCardDesc}>
                  Reconduit chaque mois, sans engagement.
                </div>
              </button>
            </div>
          )}

          <div className={s.recap}>
            <span className={s.recapLabel}>À régler aujourd&apos;hui</span>
            <span className={s.recapValue}>
              {change?.targetAmountLabel ?? payRow.totalLabel} TTC
            </span>
          </div>

          {/* Documents contractuels + case unique NON pré-cochée. Le libellé
              affiché est EXACTEMENT celui archivé dans la preuve de
              consentement (art. 5 CGV v2.1) : le reformuler l'invaliderait. */}
          <ul className={s.docList}>
            {Object.values(LEGAL_DOCUMENTS).map((doc) => (
              <li key={doc.key} className={s.docItem}>
                <span>
                  <a
                    className={s.docTitle}
                    href={doc.pageHref}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {doc.title}
                  </a>
                  <span className={s.docMeta}>Version {doc.version}</span>
                </span>
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

          {error && <div className={s.error}>{error}</div>}

          <div className={s.actions} style={{ marginTop: 0, borderTop: 0, paddingTop: 0 }}>
            <button
              type="button"
              className={`${s.btn} ${s.btnPrimary}`}
              onClick={() =>
                post("/api/portal/pay", {
                  acceptTerms: accepted,
                  ...(isResume
                    ? { plan, extraCollaborators: extra }
                    : {}),
                })
              }
              disabled={busy || !accepted}
            >
              {busy ? (
                <>
                  <span className={s.spinner} aria-hidden="true" />
                  Préparation du paiement…
                </>
              ) : (
                `Payer ${change?.targetAmountLabel ?? payRow.totalLabel}`
              )}
            </button>
            <button
              type="button"
              className={`${s.btn} ${s.btnQuiet}`}
              onClick={() => setDrawer(null)}
              disabled={busy}
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Rendu ---------- */

  const statusPill = inArrears
    ? { cls: s.pillDanger, text: "Paiement en attente" }
    : change?.kind === "cancel"
      ? { cls: s.pillWarn, text: `Résilié au ${props.periodEndLabel}` }
      : props.recurrenceStopped && props.plan === "MONTHLY"
        ? { cls: s.pillWarn, text: "Reconduction arrêtée" }
        : { cls: s.pillOk, text: "Abonnement actif" };

  return (
    <div className={s.space}>
      <div className={s.hero}>
        <div className={s.heroText}>
          <h1 className={s.title}>Mon abonnement</h1>
          <p className={s.subtitle}>{props.cabinetName}</p>
        </div>
        <span className={`${s.pill} ${statusPill.cls}`}>
          <span className={s.dot} aria-hidden="true" />
          {statusPill.text}
        </span>
      </div>

      {renderStatusNotice()}

      <div className={s.grid}>
        <div className={s.panel}>
          <div className={s.panelHead}>
            <span className={s.panelTitle}>Votre contrat</span>
          </div>
          <div className={s.panelBody}>
            <div className={s.planLine}>
              <span className={s.planName}>{props.planLabelText}</span>
              <span className={s.planPrice}>
                {props.renewalAmountLabel}
                <span className={s.planPriceUnit}>
                  {" "}
                  TTC {props.plan === "MONTHLY" ? "/ mois" : "/ an"}
                </span>
              </span>
            </div>

            <div className={s.kv}>
              <div className={s.kvRow}>
                <span className={s.kvLabel}>
                  {props.recurrenceStopped
                    ? "Accès jusqu'au"
                    : "Prochain prélèvement"}
                </span>
                <span className={s.kvValue}>{props.periodEndLabel}</span>
              </div>
              <div className={s.kvRow}>
                <span className={s.kvLabel}>Reconduction automatique</span>
                <span className={s.kvValue}>
                  {props.recurrenceStopped ? "Arrêtée" : "Active"}
                </span>
              </div>
              <div className={s.kvRow}>
                <span className={s.kvLabel}>Collaborateurs inclus</span>
                <span className={s.kvValue}>
                  {props.extraCollaborators === 0
                    ? "Titulaire seul"
                    : `Titulaire + ${props.extraCollaborators}`}
                </span>
              </div>
              <div className={s.kvRow}>
                <span className={s.kvLabel}>Moyen de paiement</span>
                <span className={`${s.kvValue} ${s.kvValueMuted}`}>
                  Carte bancaire
                </span>
              </div>
            </div>

            {/* Actions rangées de la moins engageante à la plus engageante. */}
            <div className={s.actions}>
              <button
                type="button"
                className={`${s.btn} ${s.btnGhost}`}
                onClick={() => openDrawer("plan")}
                disabled={!props.checkoutOpen || Boolean(change)}
              >
                Changer de formule
              </button>
              <button
                type="button"
                className={`${s.btn} ${s.btnGhost}`}
                onClick={() => openDrawer("card")}
                disabled={!props.checkoutOpen || Boolean(change)}
              >
                Changer de carte
              </button>
              {!change && (
                <button
                  type="button"
                  className={`${s.btn} ${s.btnDanger}`}
                  onClick={() => openDrawer("cancel")}
                >
                  Résilier
                </button>
              )}
            </div>

            {Boolean(change) && drawer !== "pay" && (
              <p className={s.empty}>
                Une demande est déjà enregistrée sur votre abonnement. Annulez-la
                d&apos;abord si vous souhaitez faire autre chose.
              </p>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gap: 22 }}>
          <div className={s.panel}>
            <div className={s.panelHead}>
              <span className={s.panelTitle}>Factures</span>
              {props.invoices.length > 0 && (
                <span className={s.panelNote}>
                  {props.invoices.length} document
                  {props.invoices.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className={s.panelBody}>
              {props.invoices.length === 0 ? (
                <p className={s.empty}>
                  Vos factures apparaîtront ici dès votre premier paiement.
                </p>
              ) : (
                <div className={s.invoiceList}>
                  {props.invoices.map((invoice) => (
                    <div key={invoice.id} className={s.invoiceRow}>
                      <div className={s.invoiceMain}>
                        <div className={s.invoiceNumber}>{invoice.number}</div>
                        <div className={s.invoiceMeta}>
                          {invoice.issuedAtLabel} · {invoice.amountLabel} TTC
                        </div>
                      </div>
                      <a
                        className={s.invoiceDl}
                        href={`/mon-abonnement/facture/${invoice.id}`}
                      >
                        PDF
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={s.panel}>
            <div className={s.panelHead}>
              <span className={s.panelTitle}>Facturation</span>
            </div>
            <div className={s.panelBody}>
              <div className={s.kv}>
                <div className={s.kvRow}>
                  <span className={s.kvLabel}>Cabinet</span>
                  <span className={s.kvValue}>{props.cabinetName}</span>
                </div>
                {props.billing.address && (
                  <div className={s.kvBlock}>
                    <span className={s.kvLabel}>Adresse de facturation</span>
                    <span className={`${s.kvBlockValue} ${s.kvBlockValueMuted}`}>
                      {props.billing.address}
                      {props.billing.postalCity
                        ? `, ${props.billing.postalCity}`
                        : ""}
                    </span>
                  </div>
                )}
                <div className={s.kvBlock}>
                  <span className={s.kvLabel}>Factures envoyées à</span>
                  <span className={`${s.kvBlockValue} ${s.kvBlockValueMuted}`}>
                    {props.billing.adminEmail || "—"}
                  </span>
                </div>
              </div>
              <p className={s.empty}>
                Ces informations viennent de votre logiciel. Modifiez-les depuis
                la page Cabinet, ou écrivez-nous à {CONTACT}.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Panneaux d'action : pleine largeur, sous la grille, jamais flottants. */}
      <div ref={drawerRef}>
        {drawer === "plan" && renderPlanDrawer()}
        {drawer === "card" && renderCardDrawer()}
        {drawer === "cancel" && renderCancelDrawer()}
        {drawer === "pay" && renderPayDrawer()}
      </div>

      <p className={s.help}>
        Une question sur votre abonnement&nbsp;? Écrivez-nous à {CONTACT}, nous
        répondons sous un jour ouvré.
      </p>
    </div>
  );
}
