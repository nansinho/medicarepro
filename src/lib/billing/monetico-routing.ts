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

/**
 * Clés à ESSAYER pour authentifier un IPN, plateforme courante en premier.
 *
 * On n'élit plus la clé, on l'identifie : le sceau est le seul discriminant
 * fiable, car le numéro de TPE est le même en test et en production. Une
 * notification émise par la plateforme où vit la commande doit être reconnue
 * même si le site est configuré sur l'autre, sinon elle est rejetée en
 * silence — et un client réellement débité passe inaperçu.
 *
 * L'ordre compte : la plateforme courante d'abord, pour que le cas normal ne
 * coûte qu'une vérification.
 */
export function moneticoIpnKeyCandidates(
  tpe: string,
): Array<{ key: string; platform: "test" | "production" }> {
  const b = billingEnv();
  const immediate = Boolean(b.moneticoTpeImmediate && tpe === b.moneticoTpeImmediate);
  const ordre: Array<"test" | "production"> =
    b.moneticoMode === "production" ? ["production", "test"] : ["test", "production"];

  const candidates: Array<{ key: string; platform: "test" | "production" }> = [];
  for (const platform of ordre) {
    const jeu = b.moneticoIpnKeys[platform];
    const key = immediate ? jeu.immediate : jeu.recurrent;
    // Une clé peut manquer (l'autre environnement n'est pas toujours configuré).
    if (key && !candidates.some((c) => c.key === key)) {
      candidates.push({ key, platform });
    }
  }
  return candidates;
}
