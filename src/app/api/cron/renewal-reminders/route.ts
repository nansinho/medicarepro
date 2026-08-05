import { env } from "@/lib/env";
import { timingSafeEqualString } from "@/lib/crypto";
import { serviceClient } from "@/lib/supabase/service";
import { sendMail } from "@/lib/email";
import { renewalReminderEmail } from "@/lib/emails/checkout-templates";
import { changeReminderEmail } from "@/lib/emails/portal-templates";
import { formatEuros, planLabel, type BillingPlan } from "@/lib/checkout/pricing";
import { notifyRenewal } from "@/lib/provisioning";
import { lapseChange } from "@/lib/billing/changes";

/* ============================================================
   /api/cron/renewal-reminders — échéances des abonnements qui ne se
   reconduisent PAS tout seuls. Une passe par jour.

   TROIS POPULATIONS, une seule raison d'être : personne ne doit perdre l'accès
   à son cabinet sans avoir été prévenu.

   1. OFFRE ANNUELLE — paiement unique, aucune reconduction carte. Rappels à
      J-30/15/7/3/0 avec le lien de renouvellement.

   2. CHANGEMENT PROGRAMMÉ (formule ou carte) — la reconduction a été arrêtée
      au moment de la demande, et le praticien doit valider un paiement à
      l'échéance. Rappels à J-7/3/0, puis J+3/J+7 : après l'échéance, c'est là
      qu'il faut insister, pas se taire.

   3. MENSUEL SANS RECONDUCTION — demande retirée, résiliation annulée, arrêt
      posé depuis le back-office. Même traitement que le cas 2 : sans paiement,
      l'accès s'arrête, et le silence serait le pire des services.

   Puis on constate : les périodes échues passent en past_due, puis en expired
   après le délai de grâce, et les demandes jamais honorées sont closes.

   Auth : Bearer CRON_SECRET. Un palier n'est envoyé qu'UNE fois par échéance
   (table subscription_reminders, clé unique) : l'INSERT sert de claim, l'email
   ne part qu'après.
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Offre annuelle : anticipation seulement, le lien reste valable. */
const ANNUAL_STAGES = [30, 15, 7, 3, 0] as const;
/** Validation à faire : on relance aussi APRÈS l'échéance. */
const VALIDATION_STAGES = [7, 3, 0, -3, -7] as const;

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
  app_cabinet_id: string;
  cabinet_name: string;
  admin_email: string;
  admin_name: string;
  plan: BillingPlan;
  extra_collaborators: number;
  current_period_end: string;
  renewal_amount_cents: number;
  currency: string;
  recurrence_stopped_at: string | null;
};

type ChangeRow = {
  id: string;
  subscription_id: string;
  kind: "plan_change" | "card_update" | "cancel";
  target_plan: BillingPlan | null;
  target_extra_collaborators: number | null;
  target_amount_cents: number | null;
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
  /* Fenêtre : de J-8 (relances tardives) à J+31 (premier palier annuel). */
  const from = new Date(Date.now() - 8 * 86_400_000).toISOString();
  const to = new Date(Date.now() + 32 * 86_400_000).toISOString();

  /* CE QUI NE SE RECONDUIT PAS TOUT SEUL, ET RIEN D'AUTRE.

     La règle était « l'annuel par nature, plus tout contrat dont la récurrence a
     été arrêtée ». Elle était juste chez Monetico, où un annuel passait par le
     TPE immédiat : un paiement unique, sans reconduction, qu'il fallait rappeler
     au client avant l'échéance.

     ELLE EST FAUSSE ET DANGEREUSE CHEZ STRIPE, où l'annuel se reconduit comme le
     mensuel. Un cabinet parfaitement à jour aurait reçu « votre abonnement
     expire le X, renouvelez » à J-30, 15, 7, 3 et 0, avec un lien de paiement
     qui l'aurait fait payer une SECONDE année.

     Le seul critère qui vaut pour les deux prestataires est le fait constaté :
     la reconduction est-elle arrêtée ? `recurrence_stopped_at` le dit, et il est
     posé sur les annuels Monetico dès leur création comme sur toute résiliation
     programmée. */
  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      "id, app_cabinet_id, cabinet_name, admin_email, admin_name, plan, extra_collaborators, current_period_end, renewal_amount_cents, currency, recurrence_stopped_at",
    )
    .eq("status", "active")
    .gte("current_period_end", from)
    .lte("current_period_end", to)
    .not("recurrence_stopped_at", "is", null);
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const subs = (data ?? []) as SubRow[];

  /* Les demandes en attente de ces contrats, en une seule requête : c'est
     elles qui décident du message à envoyer. */
  const changes = new Map<string, ChangeRow>();
  if (subs.length > 0) {
    const { data: changeRows } = await supabase
      .from("subscription_changes")
      .select(
        "id, subscription_id, kind, target_plan, target_extra_collaborators, target_amount_cents",
      )
      .eq("status", "scheduled")
      .in(
        "subscription_id",
        subs.map((sub) => sub.id),
      );
    for (const row of (changeRows ?? []) as ChangeRow[]) {
      changes.set(row.subscription_id, row);
    }
  }

  let sent = 0;

  for (const sub of subs) {
    const change = changes.get(sub.id);

    /* Résiliation demandée : il n'y a rien à valider, et relancer quelqu'un
       qui a choisi de partir serait déplacé. La date de fin lui a été
       confirmée par écrit au moment de sa demande. */
    if (change?.kind === "cancel") continue;

    const d = daysUntil(sub.current_period_end, todayDay);
    const stages: readonly number[] =
      change || sub.plan === "MONTHLY" ? VALIDATION_STAGES : ANNUAL_STAGES;
    if (!stages.includes(d)) continue;

    // Claim atomique : si le palier est déjà pris, l'INSERT échoue (unique).
    const { error: claimErr } = await supabase
      .from("subscription_reminders")
      .insert({
        subscription_id: sub.id,
        period_end: sub.current_period_end,
        days_before: d,
      });
    if (claimErr) continue;

    try {
      const firstName = (sub.admin_name ?? "").trim().split(/\s+/)[0] ?? "";

      if (!change && sub.plan === "ANNUAL") {
        /* Renouvellement annuel. Le lien signé de longue durée a disparu avec
           Monetico : un abonnement se reprend désormais depuis l'espace
           abonnement, ouvert par un lien à usage unique que seul le logiciel
           du praticien peut délivrer. */
        await sendMail({
          to: sub.admin_email,
          ...renewalReminderEmail({
            adminFirstName: firstName,
            cabinetName: sub.cabinet_name,
            expiresAtLabel: frDate(sub.current_period_end),
            daysBefore: d,
            amountLabel: formatEuros(sub.renewal_amount_cents),
          }),
        });
      } else {
        /* Validation à faire. Pas de lien : l'espace s'ouvre depuis le
           logiciel, par un lien à usage unique valable quinze minutes, qu'un
           email ne peut donc pas transporter. */
        const targetPlan = change?.target_plan ?? sub.plan;
        const targetExtra =
          change?.target_extra_collaborators ?? sub.extra_collaborators;
        await sendMail({
          to: sub.admin_email,
          ...changeReminderEmail({
            adminFirstName: firstName,
            cabinetName: sub.cabinet_name,
            kind:
              change?.kind === "card_update"
                ? "card_update"
                : change?.kind === "plan_change"
                  ? "plan_change"
                  : "renewal",
            planLabel: planLabel(targetPlan, targetExtra),
            amountLabel: formatEuros(
              change?.target_amount_cents ?? sub.renewal_amount_cents,
            ),
            dueAtLabel: frDate(sub.current_period_end),
            daysBefore: d,
          }),
        });
      }
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

  /* --- Constat des échéances manquées ---------------------------------- */

  const expired = await expireDue(supabase);

  return Response.json({ sent, ...expired });
}

/**
 * Fait tomber les périodes échues sans reconduction, puis clôt les demandes
 * jamais honorées.
 *
 * L'ÉTAT SUIT LE FAIT, ET SEULEMENT LUI : on ne touche qu'aux contrats dont la
 * récurrence est arrêtée. Un mensuel encore reconduit dont l'échéance vient de
 * passer attend simplement sa notification bancaire — le déclarer impayé à la
 * place de la banque couperait un cabinet parfaitement à jour.
 */
async function expireDue(
  supabase: NonNullable<ReturnType<typeof serviceClient>>,
): Promise<{ pastDue: number; expired: number; lapsed: number }> {
  let pastDue = 0;
  let closed = 0;
  let lapsed = 0;

  const { data, error } = await supabase.rpc("expire_due_subscriptions", {
    p_grace_days: 14,
  });
  if (error) {
    console.error("[renewal-reminders] expire_due_subscriptions :", error.message);
    return { pastDue, expired: closed, lapsed };
  }

  const moved = (data ?? []) as { subscription_id: string; new_status: string }[];
  if (moved.length === 0) return { pastDue, expired: closed, lapsed };

  const { data: rows } = await supabase
    .from("subscriptions")
    .select("id, app_cabinet_id, plan, status, grace_until")
    .in(
      "id",
      moved.map((row) => row.subscription_id),
    );

  for (const row of (rows ?? []) as {
    id: string;
    app_cabinet_id: string;
    plan: BillingPlan;
    status: string;
    grace_until: string | null;
  }[]) {
    if (row.status === "expired") closed += 1;
    else pastDue += 1;

    /* Une demande qu'on n'honorera plus : on la clôt pour que l'espace cesse
       d'annoncer un changement à venir, et que le praticien puisse en faire
       une autre. */
    if (row.status === "expired") {
      const { data: pending } = await supabase
        .from("subscription_changes")
        .select("id")
        .eq("subscription_id", row.id)
        .eq("status", "scheduled")
        .maybeSingle();
      if (pending) {
        await lapseChange(supabase, (pending as { id: string }).id);
        lapsed += 1;
      }
    }

    /* Remontée à l'application : sans elle, un abonnement échu reste affiché
       comme valide dans le logiciel, indéfiniment. */
    try {
      await notifyRenewal({
        idempotencyKey: `sub-${row.id}-${row.status}-${parisDay(new Date())}`,
        cabinetId: row.app_cabinet_id,
        plan: row.plan,
        status: row.status === "expired" ? "EXPIRED" : "PAST_DUE",
        ...(row.grace_until ? { graceUntil: row.grace_until } : {}),
      });
    } catch (err) {
      console.error(
        "[renewal-reminders] remontée d'expiration :",
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  return { pastDue, expired: closed, lapsed };
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}
