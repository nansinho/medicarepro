"use client";

import { useEffect, useState } from "react";
import MoneticoRedirectForm from "./MoneticoRedirectForm";
import s from "./Checkout.module.css";

/* ============================================================
   Suivi post-paiement : interroge GET /api/checkout/status
   (cookie httpOnly mp_checkout) toutes les 2,5 s pendant 3 min
   max, et raconte à l'utilisateur où en est son dossier :
   paiement en attente → confirmé → espace en création → prêt.
   En cas de refus carte, propose de relancer un paiement via
   POST /api/checkout/retry (nouveau formulaire Monetico).
   ============================================================ */

const POLL_INTERVAL_MS = 2_500;
const POLL_TIMEOUT_MS = 3 * 60 * 1_000;

type StatusResponse = {
  status: string;
  paymentRefused: boolean;
  /** Dossier figé : encaissé, mais plus aucune tentative automatique prévue. */
  needsReview?: boolean;
  loginUrl: string | null;
};

type Phase =
  | "polling" // on interroge le statut
  | "refused" // paiement refusé/annulé → proposer de réessayer
  | "provisioned" // espace prêt
  | "review" // paiement encaissé mais vérification manuelle nécessaire
  | "timeout" // 3 min sans état final
  | "forbidden"; // cookie absent (autre navigateur…)

const REVIEW_STATUSES = ["failed_conflict", "duplicate_paid", "amount_mismatch"];

function IconCheck() {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export default function ConfirmationPoller({
  reference,
}: {
  reference: string;
}) {
  const [phase, setPhase] = useState<Phase>("polling");
  const [status, setStatus] = useState("payment_pending");
  const [loginUrl, setLoginUrl] = useState<string | null>(null);
  const [redirect, setRedirect] = useState<{
    action: string;
    fields: Record<string, string>;
  } | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  useEffect(() => {
    if (phase !== "polling") return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    async function tick() {
      if (stopped) return;
      if (Date.now() > deadline) {
        setPhase("timeout");
        return;
      }
      try {
        const res = await fetch(
          `/api/checkout/status?ref=${encodeURIComponent(reference)}`,
          { credentials: "same-origin", cache: "no-store" },
        );
        if (stopped) return;
        if (res.status === 403) {
          setPhase("forbidden");
          return;
        }
        if (res.ok) {
          const data = (await res.json()) as StatusResponse;
          if (stopped) return;
          setStatus(data.status);
          if (data.loginUrl) setLoginUrl(data.loginUrl);
          if (data.status === "provisioned") {
            setPhase("provisioned");
            return;
          }
          /* needsReview : le dossier est encaissé mais figé (échec non
             rejouable). Sans ça, l'attente tournait 3 minutes avant de
             promettre un email qui ne serait jamais parti. */
          if (data.needsReview || REVIEW_STATUSES.includes(data.status)) {
            setPhase("review");
            return;
          }
          if (data.paymentRefused) {
            setPhase("refused");
            return;
          }
        }
        // Réponse non-OK (5xx transitoire…) : on retentera au prochain tour.
      } catch {
        // Erreur réseau transitoire : on retentera au prochain tour.
      }
      timer = setTimeout(tick, POLL_INTERVAL_MS);
    }

    tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [phase, reference]);

  async function retryPayment() {
    setRetrying(true);
    setRetryError(null);
    try {
      const res = await fetch("/api/checkout/retry", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          action: string;
          fields: Record<string, string>;
        };
        setRedirect({ action: data.action, fields: data.fields });
        return;
      }
      if (res.status === 403) {
        setPhase("forbidden");
        return;
      }
      if (res.status === 429) {
        setRetryError(
          "Trop de tentatives. Patientez quelques minutes avant de réessayer.",
        );
      } else {
        setRetryError(
          "Impossible de relancer le paiement pour le moment. Réessayez ou contactez-nous à contact@medicarepro.fr.",
        );
      }
    } catch {
      setRetryError(
        "Impossible de contacter le serveur. Vérifiez votre connexion puis réessayez.",
      );
    } finally {
      setRetrying(false);
    }
  }

  /* Relance du paiement : on repart vers Monetico. */
  if (redirect) {
    return (
      <div className={s.shell}>
        <MoneticoRedirectForm action={redirect.action} fields={redirect.fields} />
      </div>
    );
  }

  const paidInProgress = status === "paid" || status === "provisioning";

  return (
    <div className={s.shell}>
      <div className={s.head}>
        <h1 className={s.title}>Confirmation d&apos;inscription</h1>
        <p className={s.subtitle}>
          <span className={s.refBadge}>Référence {reference}</span>
        </p>
      </div>

      {phase === "polling" && (
        <div className={s.centerCard} role="status" aria-live="polite">
          {paidInProgress ? (
            <>
              <div className={s.statusIconOk} aria-hidden="true">
                <IconCheck />
              </div>
              <p className={s.centerTitle}>Paiement confirmé ✓</p>
              <p className={s.centerText}>
                Création de votre espace MediCare Pro en cours… Cela ne prend
                généralement que quelques secondes.
              </p>
              <span className={s.spinnerLarge} aria-hidden="true" />
            </>
          ) : (
            <>
              <span className={s.spinnerLarge} aria-hidden="true" />
              <p className={s.centerTitle}>
                Confirmation du paiement en cours…
              </p>
              <p className={s.centerText}>
                Nous attendons la confirmation de la banque. Ne fermez pas
                cette fenêtre — cela ne prend généralement que quelques
                secondes.
              </p>
            </>
          )}
        </div>
      )}

      {phase === "refused" && (
        <div className={s.centerCard}>
          <div className={s.statusIconWarn} aria-hidden="true">
            <IconClock />
          </div>
          <p className={s.centerTitle}>Paiement non abouti</p>
          <p className={s.centerText}>
            Votre paiement a été refusé ou annulé. Aucune somme n&apos;a été
            débitée — vous pouvez relancer le paiement avec la même carte ou
            une autre.
          </p>
          {retryError && (
            <div className={s.banner} role="alert">
              <span>{retryError}</span>
            </div>
          )}
          <button
            type="button"
            className={s.btnPrimary}
            onClick={retryPayment}
            disabled={retrying}
          >
            {retrying ? (
              <>
                <span className={s.spinner} aria-hidden="true" />
                Préparation du paiement…
              </>
            ) : (
              "Réessayer le paiement"
            )}
          </button>
        </div>
      )}

      {phase === "provisioned" && (
        <div className={s.centerCard}>
          <div className={s.statusIconOk} aria-hidden="true">
            <IconCheck />
          </div>
          <p className={s.centerTitle}>Votre espace est prêt !</p>
          <p className={s.centerText}>
            Paiement confirmé et cabinet créé. Votre reçu et votre facture vous
            sont envoyés par email.
          </p>
          {loginUrl ? (
            <a className={s.btnPrimary} href={loginUrl}>
              Accéder à mon espace →
            </a>
          ) : (
            <p className={s.centerText}>
              Votre lien de connexion vous a été envoyé par email.
            </p>
          )}
        </div>
      )}

      {phase === "review" && (
        <div className={s.centerCard}>
          <div className={s.statusIconWarn} aria-hidden="true">
            <IconClock />
          </div>
          <p className={s.centerTitle}>Vérification en cours</p>
          <p className={s.centerText}>
            Votre paiement est enregistré. Une vérification est
            nécessaire&nbsp;: notre équipe vous contacte sous 24&nbsp;h
            ouvrées. Aucune action n&apos;est requise de votre part.
          </p>
          <p className={s.centerText}>
            Une question&nbsp;?{" "}
            <a href="mailto:contact@medicarepro.fr">contact@medicarepro.fr</a>
          </p>
        </div>
      )}

      {phase === "timeout" && (
        <div className={s.centerCard}>
          <div className={s.statusIconWarn} aria-hidden="true">
            <IconClock />
          </div>
          <p className={s.centerTitle}>
            La confirmation prend plus de temps que prévu
          </p>
          <p className={s.centerText}>
            Pas d&apos;inquiétude&nbsp;: vous recevrez un email dès
            l&apos;activation de votre espace. Vous pouvez fermer cette page en
            toute sécurité.
          </p>
        </div>
      )}

      {phase === "forbidden" && (
        <div className={s.centerCard}>
          <div className={s.statusIconWarn} aria-hidden="true">
            <IconClock />
          </div>
          <p className={s.centerTitle}>Suivi indisponible sur ce navigateur</p>
          <p className={s.centerText}>
            Nous ne pouvons pas afficher le suivi de votre inscription depuis
            ce navigateur. Suivez le lien reçu par email, ou contactez-nous à{" "}
            <a href="mailto:contact@medicarepro.fr">contact@medicarepro.fr</a>.
          </p>
        </div>
      )}
    </div>
  );
}
