"use client";

import { useEffect, useRef } from "react";
import s from "./Checkout.module.css";

/* ============================================================
   Départ vers la page de paiement Stripe.

   POURQUOI UN COMPOSANT, ET PAS UN SIMPLE window.location.replace().
   Une navigation n'est pas instantanée : sur une connexion lente, la page de
   Stripe met une seconde ou deux à s'ouvrir. Pendant ce temps, le tunnel
   restait affiché avec son bouton de paiement réactivé — un client qui trouve
   que « rien ne se passe » clique une seconde fois, et ouvre un SECOND dossier
   d'inscription : nouvelle référence, nouveaux secrets chiffrés, nouveau client
   Stripe, et un préfixe de facturation consommé pour rien.

   En remplaçant tout l'écran, il n'y a plus rien à cliquer. C'est exactement ce
   que faisait déjà le formulaire scellé de Monetico, mais pour lui c'était un
   effet de bord du changement d'écran, pas une décision.

   `replace` et non `assign` : le retour arrière depuis la page de paiement ne
   doit pas ramener sur un tunnel dont le dossier est déjà ouvert.
   ============================================================ */

export default function StripeRedirect({ url }: { url: string }) {
  const parti = useRef(false);

  useEffect(() => {
    if (parti.current) return;
    parti.current = true;
    window.location.replace(url);
  }, [url]);

  return (
    <div className={s.centerCard} role="status" aria-live="polite">
      <span className={s.spinnerLarge} aria-hidden="true" />
      <p className={s.centerTitle}>Redirection vers le paiement sécurisé…</p>
      <p className={s.centerText}>
        Vous allez être redirigé vers la page de paiement Stripe. Ne fermez pas
        cette fenêtre.
      </p>
      {/* Filet si la redirection automatique est bloquée (extension, JS
          interrompu) : sans lui, l'écran tournerait sans issue. */}
      <a href={url} className={s.btnGhost}>
        Continuer vers le paiement
      </a>
    </div>
  );
}
