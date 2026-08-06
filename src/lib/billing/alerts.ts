import "server-only";
import { sendMail } from "@/lib/email";
import { billingAlertEmail } from "@/lib/emails/checkout-templates";
import { billingEnv, hasBilling } from "@/lib/env";

/* ============================================================
   L'ALERTE INTERNE DE FACTURATION, dans son propre module.

   Elle vivait dans `stripe-events.ts`, ce qui allait tant que ce fichier était
   le seul à alerter. Il ne l'est plus : `instalments.ts` alerte aussi, et
   `stripe-events.ts` doit l'appeler pour router les versements. Les deux
   s'importaient donc l'un l'autre.

   Un cycle d'imports ne casse pas toujours — le chargeur de modules hisse les
   déclarations de fonctions et ça passe souvent. « Souvent » est le problème :
   l'ordre d'évaluation dépend de qui est chargé en premier, ce qui varie entre
   le développement et la compilation. On y gagnerait une panne au démarrage,
   en production, sans rapport visible avec la cause.

   Ce fichier ne dépend de rien du domaine facturation : il ne peut donc entrer
   dans aucun cycle.
   ============================================================ */

/** Alerte interne — best-effort, ne jette jamais. */
export async function alerteStripe(
  title: string,
  lines: string[],
): Promise<void> {
  try {
    if (!hasBilling()) return;
    const mail = billingAlertEmail({ title, lines });
    await sendMail({ to: billingEnv().billingAlertsTo, ...mail });
  } catch (err) {
    /* Une alerte qui jetterait ferait échouer le traitement qu'elle signale :
       on perdrait l'encaissement pour n'avoir pas su envoyer un courriel. */
    console.error(
      "[billing] échec alerte :",
      err instanceof Error ? err.message : String(err),
    );
  }
}
