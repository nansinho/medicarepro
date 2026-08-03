import { env } from "@/lib/env";
import { timingSafeEqualString } from "@/lib/crypto";
import { serviceClient } from "@/lib/supabase/service";
import { sendMail } from "@/lib/email";
import { renewalReminderEmail } from "@/lib/emails/checkout-templates";
import { formatEuros } from "@/lib/checkout/pricing";
import { buildRenewalUrl } from "@/lib/billing/renewal-link";

/* ============================================================
   /api/cron/renewal-reminders — rappels d'échéance de l'offre
   ANNUELLE (paiement unique, sans reconduction carte).

   À J-30/15/7/3/0 avant la fin des 12 mois, on prévient le client
   pour qu'il renouvelle avant de perdre l'accès. Un palier n'est
   envoyé qu'UNE fois par échéance (table subscription_reminders,
   clé unique) : l'INSERT sert de claim, l'email ne part qu'après.

   Le mensuel n'est PAS concerné : il se reconduit tout seul.
   Auth : Bearer CRON_SECRET. À planifier une fois par jour.
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STAGES = [30, 15, 7, 3, 0] as const;

function isAuthorized(request: Request): boolean {
  const secret = env().CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return token.length > 0 && timingSafeEqualString(token, secret);
}

/** "2027-07-29" — jour civil à Paris (pour un diff en jours calendaires). */
function parisDay(iso: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** Nombre de jours calendaires entre aujourd'hui et une date (Paris). */
function daysUntil(periodEndIso: string, todayDay: string): number {
  const end = Date.parse(parisDay(periodEndIso) + "T00:00:00Z");
  const today = Date.parse(todayDay + "T00:00:00Z");
  return Math.round((end - today) / 86_400_000);
}

function frDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeZone: "Europe/Paris",
  }).format(new Date(iso));
}

type SubRow = {
  id: string;
  cabinet_name: string;
  admin_email: string;
  admin_name: string;
  current_period_end: string;
  renewal_amount_cents: number;
  currency: string;
};

async function handle(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Non autorisé." }, { status: 401 });
  }
  const supabase = serviceClient();
  if (!supabase) {
    return Response.json({ error: "Base non configurée." }, { status: 503 });
  }

  const todayDay = parisDay(new Date());
  // Fenêtre large (couvre tous les paliers) : de la veille à J+31.
  const from = new Date(Date.now() - 86_400_000).toISOString();
  const to = new Date(Date.now() + 32 * 86_400_000).toISOString();

  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      "id, cabinet_name, admin_email, admin_name, current_period_end, renewal_amount_cents, currency",
    )
    .eq("plan", "ANNUAL")
    .eq("status", "active")
    .gte("current_period_end", from)
    .lte("current_period_end", to);
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  for (const sub of (data ?? []) as SubRow[]) {
    const d = daysUntil(sub.current_period_end, todayDay);
    if (!STAGES.includes(d as (typeof STAGES)[number])) continue;

    // Claim atomique : si le palier est déjà pris pour cette échéance,
    // l'INSERT échoue (unique) et on n'envoie rien.
    const { error: claimErr } = await supabase
      .from("subscription_reminders")
      .insert({
        subscription_id: sub.id,
        period_end: sub.current_period_end,
        days_before: d,
      });
    if (claimErr) continue; // 23505 (déjà envoyé) ou autre : on passe

    try {
      const mail = renewalReminderEmail({
        adminFirstName: sub.admin_name.trim().split(/\s+/)[0] ?? "",
        cabinetName: sub.cabinet_name,
        expiresAtLabel: frDate(sub.current_period_end),
        daysBefore: d,
        amountLabel: formatEuros(sub.renewal_amount_cents),
        renewUrl: buildRenewalUrl(sub.id),
      });
      await sendMail({ to: sub.admin_email, ...mail });
      sent += 1;
    } catch (err) {
      // Envoi échoué : on libère le claim pour retenter demain.
      await supabase
        .from("subscription_reminders")
        .delete()
        .eq("subscription_id", sub.id)
        .eq("period_end", sub.current_period_end)
        .eq("days_before", d);
      console.error(
        "[renewal-reminders] échec envoi :",
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  return Response.json({ sent });
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}
