import "server-only";
import { sendMail } from "@/lib/email";
import { billingAlertEmail } from "@/lib/emails/checkout-templates";
import { billingEnv, hasBilling } from "@/lib/env";
import { serviceClient } from "@/lib/supabase/service";

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

/**
 * Une alerte qui se répète cesse d'être une alerte.
 *
 * Certaines causes ne produisent pas un incident mais un ROBINET : un point de
 * terminaison mal réglé re-livre des dizaines de fois, et Stripe insiste trois
 * jours durant. Le 06/08/2026, la boîte du client a reçu une trentaine de fois
 * le même message en deux heures, et il a cessé de les lire. C'est exactement
 * l'effet inverse de celui qu'on cherche.
 *
 * Les appelants concernés passent donc une clé : la première alerte part, les
 * suivantes sont tues pendant la fenêtre demandée. Le compteur est en base, et
 * vaut donc pour toutes les instances du serveur.
 *
 * En panne de compteur, on ALERTE quand même : mieux vaut un courriel de trop
 * qu'un incident muet.
 */
async function alerteAutorisee(key: string, seconds: number): Promise<boolean> {
  const supabase = serviceClient();
  if (!supabase) return true;
  const { data, error } = await supabase.rpc("hit_rate_limit", {
    p_bucket: `alert:${key}`,
    p_limit: 1,
    p_window_seconds: seconds,
  });
  if (error) return true;
  return data === true;
}

/** Alerte interne — best-effort, ne jette jamais. */
export async function alerteStripe(
  title: string,
  lines: string[],
  options: { throttleKey?: string; throttleSeconds?: number } = {},
): Promise<void> {
  try {
    if (!hasBilling()) return;
    if (
      options.throttleKey &&
      !(await alerteAutorisee(
        options.throttleKey,
        options.throttleSeconds ?? 3600,
      ))
    ) {
      console.warn(`[billing] alerte groupée (${options.throttleKey}) : ${title}`);
      return;
    }
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
