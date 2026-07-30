import "server-only";
import { billingEnv } from "@/lib/env";
import type { MoneticoConfig } from "@/lib/monetico";
import type { BillingPlan } from "@/lib/checkout/pricing";

/* ============================================================
   Routage multi-TPE Monetico.

   MediCare Pro vend deux formules sur DEUX TPE distincts :
   - MONTHLY → TPE récurrent (NB8179R) : reconduction carte
     automatique, encaissement géré par capture.ts ;
   - ANNUAL  → TPE immédiat (NB8179I) : paiement UNIQUE, encaissé
     d'office par la banque (« seuls les TPE en paiement immédiat
     ne requièrent aucune action »), sans reconduction carte — le
     renouvellement se fait sur rappel côté app.

   Deux TPE = deux clés. On route le formulaire aller par le PLAN,
   et la vérification de l'IPN par le champ TPE reçu.
   ============================================================ */

/**
 * Config Monetico (TPE + clé + code site) selon la formule.
 * billingEnv() garantit la config immédiate dès que l'annuel est vendable :
 * on n'atteint jamais la branche ANNUAL avec des champs vides.
 */
export function moneticoConfigForPlan(plan: BillingPlan): MoneticoConfig {
  const b = billingEnv();
  if (plan === "ANNUAL") {
    return {
      tpe: b.moneticoTpeImmediate,
      key: b.moneticoKeyImmediate,
      societe: b.moneticoSocieteImmediate,
      mode: b.moneticoMode,
    };
  }
  return {
    tpe: b.moneticoTpe,
    key: b.moneticoKey,
    societe: b.moneticoSociete,
    mode: b.moneticoMode,
  };
}

/**
 * Clé de vérification d'un IPN selon le TPE qui l'a émis.
 * Le plan n'apparaît pas dans l'IPN : on se fie au champ TPE. L'annuel vient
 * du TPE immédiat (clé propre) ; tout le reste, du TPE récurrent.
 */
export function moneticoKeyForTpe(tpe: string): string {
  const b = billingEnv();
  if (b.moneticoTpeImmediate && tpe === b.moneticoTpeImmediate) {
    return b.moneticoKeyImmediate;
  }
  return b.moneticoKey;
}
