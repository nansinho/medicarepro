"use client";

import { useEffect, useRef } from "react";
import s from "./Checkout.module.css";

/* ============================================================
   Redirection vers la page de paiement Monetico (CIC).
   Monetico n'accepte que le POST d'un formulaire scellé (MAC) :
   on rend les champs en inputs cachés puis on auto-soumet.
   Un bouton reste visible au cas où l'auto-submit serait bloqué
   (extensions, JS interrompu…).
   ============================================================ */

type Props = {
  action: string;
  fields: Record<string, string>;
};

export default function MoneticoRedirectForm({ action, fields }: Props) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current) return;
    submitted.current = true;
    // submit() natif : ne repasse pas par React, POST direct vers Monetico.
    formRef.current?.submit();
  }, []);

  return (
    <div className={s.centerCard} role="status" aria-live="polite">
      <span className={s.spinnerLarge} aria-hidden="true" />
      <p className={s.centerTitle}>Redirection vers le paiement sécurisé…</p>
      <p className={s.centerText}>
        Vous allez être redirigé vers la page de paiement Monetico (CIC). Ne
        fermez pas cette fenêtre.
      </p>
      <form ref={formRef} method="POST" action={action}>
        {Object.entries(fields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <button type="submit" className={s.btnGhost}>
          Continuer vers le paiement
        </button>
      </form>
    </div>
  );
}
