import "server-only";
import { serviceClient } from "@/lib/supabase/service";

/* ============================================================
   Trace d'audit → table audit_log (0011, append-only).
   Best-effort : un échec d'audit ne casse JAMAIS l'opération
   métier (il est signalé en console). Aucune donnée sensible
   dans diff (pas de mot de passe, IBAN, clé, MAC…).
   ============================================================ */

export type AuditEntry = {
  action: string; // ex. checkout.created, ipn.paid, mandate.signed, remittance.exported
  entityType?: string;
  entityId?: string;
  diff?: Record<string, unknown>;
  actorId?: string;
  actorEmail?: string;
  ip?: string;
  userAgent?: string;
};

export async function logAudit(entry: AuditEntry): Promise<void> {
  const supabase = serviceClient();
  if (!supabase) return; // Supabase non configuré (dev sans base)

  const { error } = await supabase.from("audit_log").insert({
    action: entry.action,
    entity_type: entry.entityType ?? null,
    entity_id: entry.entityId ?? null,
    diff: entry.diff ?? null,
    actor_id: entry.actorId ?? null,
    actor_email: entry.actorEmail ?? null,
    ip: entry.ip ?? null,
    user_agent: entry.userAgent ?? null,
  });

  if (error) {
    console.error(`[audit] échec d'écriture (${entry.action}) :`, error.message);
  }
}
