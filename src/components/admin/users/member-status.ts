import { staffLinkExpiry } from "@/lib/admin/staff-links";

/* ============================================================
   État d'un membre du back office, déduit de son compte GoTrue.
   Pur : partagé par la page (serveur) et les actions de ligne (client).
   ============================================================ */

export type MemberStatus = "active" | "invited" | "invite_expired" | "disabled";

export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  active: "Actif",
  invited: "Invitation envoyée",
  invite_expired: "Invitation expirée",
  disabled: "Désactivé",
};

export const MEMBER_STATUS_VARIANT: Record<
  MemberStatus,
  "green" | "amber" | "gray" | "blue"
> = {
  active: "green",
  invited: "blue",
  invite_expired: "amber",
  disabled: "gray",
};

export function memberStatus(
  auth: {
    email_confirmed_at?: string | null;
    banned_until?: string | null;
    confirmation_sent_at?: string | null;
    invited_at?: string | null;
  },
  now: Date = new Date(),
): { status: MemberStatus; inviteExpiresAt: string | null } {
  if (auth.banned_until && Date.parse(auth.banned_until) > now.getTime()) {
    return { status: "disabled", inviteExpiresAt: null };
  }
  if (auth.email_confirmed_at) return { status: "active", inviteExpiresAt: null };

  /* confirmation_sent_at suit chaque renvoi ; invited_at en repli. */
  const sentAt = auth.confirmation_sent_at ?? auth.invited_at ?? null;
  if (!sentAt) return { status: "invite_expired", inviteExpiresAt: null };
  const expires = staffLinkExpiry(sentAt);
  return {
    status: expires.getTime() > now.getTime() ? "invited" : "invite_expired",
    inviteExpiresAt: expires.toISOString(),
  };
}
