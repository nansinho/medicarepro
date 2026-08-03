"use client";

import { useState } from "react";
import MoneticoRedirectForm from "./MoneticoRedirectForm";
import s from "./Checkout.module.css";

/* ============================================================
   Bouton de renouvellement : POST /api/checkout/renew → récupère
   le formulaire Monetico scellé → auto-redirection vers le
   paiement. Le jeton signé (du lien de rappel) fait l'auth.
   ============================================================ */

type Redirect = { action: string; fields: Record<string, string> };

export default function RenewButton({
  token,
  amountLabel,
}: {
  token: string;
  amountLabel: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirect, setRedirect] = useState<Redirect | null>(null);

  if (redirect) {
    return <MoneticoRedirectForm action={redirect.action} fields={redirect.fields} />;
  }

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout/renew", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        const data = (await res.json()) as Redirect;
        setRedirect(data);
        return;
      }
      if (res.status === 429) {
        setError("Trop de tentatives. Patientez quelques minutes.");
      } else {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(
          body?.error ??
            "Le renouvellement est momentanément indisponible. Réessayez ou écrivez-nous à contact@medicarepro.fr.",
        );
      }
    } catch {
      setError("Impossible de contacter le serveur. Vérifiez votre connexion.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {error && (
        <div className={s.banner} role="alert">
          <span>{error}</span>
        </div>
      )}
      <button
        type="button"
        className={s.btnPrimary}
        onClick={pay}
        disabled={busy}
      >
        {busy ? (
          <>
            <span className={s.spinner} aria-hidden="true" />
            Préparation du paiement…
          </>
        ) : (
          `Payer ${amountLabel} et renouveler`
        )}
      </button>
    </>
  );
}
