import { afterEach, describe, expect, it } from "vitest";
import { staffInviteEmail, staffRecoveryEmail } from "@/lib/emails/staff-templates";
import { staffConfirmUrl, staffLinkExpiry } from "@/lib/admin/staff-links";
import { memberStatus } from "@/components/admin/users/member-status";

/* ============================================================
   Invitations et réinitialisations du back office.

   Constaté le 26/09/2026 : envoyées depuis le poste de développement,
   elles portaient un lien localhost:3004, mort pour la personne invitée.
   ============================================================ */

const previousSite = process.env.NEXT_PUBLIC_SITE_URL;
const previousForced = process.env.EMAIL_LINKS_ORIGIN;

afterEach(() => {
  if (previousSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = previousSite;
  if (previousForced === undefined) delete process.env.EMAIL_LINKS_ORIGIN;
  else process.env.EMAIL_LINKS_ORIGIN = previousForced;
});

describe("lien d'activation", () => {
  it("mène au domaine public même depuis un poste local", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3004";
    delete process.env.EMAIL_LINKS_ORIGIN;
    const url = new URL(staffConfirmUrl("abc123", "invite", "marie+test@exemple.fr"));
    expect(url.origin).toBe("https://medicarepro.fr");
    expect(url.pathname).toBe("/admin/auth/confirm");
    expect(url.searchParams.get("token_hash")).toBe("abc123");
    expect(url.searchParams.get("type")).toBe("invite");
    // Le « + » survit à l'encodage (il deviendrait une espace sinon).
    expect(url.searchParams.get("email")).toBe("marie+test@exemple.fr");
  });

  it("expire 24 heures après l'envoi", () => {
    expect(staffLinkExpiry("2026-09-26T10:00:00.000Z").toISOString()).toBe(
      "2026-09-27T10:00:00.000Z",
    );
  });
});

describe("emails d'équipe", () => {
  const LIEN = "https://medicarepro.fr/admin/auth/confirm?token_hash=abc&type=invite";

  it("invitation : lien, rôle, identifiant et durée annoncés", () => {
    const m = staffInviteEmail({
      link: LIEN,
      role: "editor",
      email: "marie@exemple.fr",
      inviterName: "Nans",
      validHours: 24,
    });
    expect(m.html).toContain(LIEN.replace(/&/g, "&amp;"));
    expect(m.text).toContain(LIEN);
    expect(m.text).toContain("éditeur");
    expect(m.text).toContain("marie@exemple.fr");
    expect(m.text).toContain("24 heures");
    expect(m.text).toContain("Nans vous invite");
    expect(m.html).not.toMatch(/localhost/);
  });

  it("n'écrit pas de tiret cadratin (règle éditoriale)", () => {
    const invite = staffInviteEmail({ link: LIEN, role: "admin", email: "a@b.fr", validHours: 24 });
    const reset = staffRecoveryEmail({ link: LIEN, email: "a@b.fr", validHours: 24 });
    for (const m of [invite, reset]) {
      expect(m.subject).not.toContain("—");
      expect(m.text).not.toContain("—");
    }
  });

  it("échappe le nom de l'invitant", () => {
    const m = staffInviteEmail({
      link: LIEN,
      role: "admin",
      email: "a@b.fr",
      inviterName: "<script>x</script>",
      validHours: 24,
    });
    expect(m.html).not.toContain("<script>x</script>");
  });
});

describe("état d'un membre", () => {
  const now = new Date("2026-09-26T12:00:00.000Z");

  it("compte confirmé : actif", () => {
    expect(memberStatus({ email_confirmed_at: "2026-09-01T00:00:00Z" }, now).status).toBe("active");
  });

  it("invitation de moins de 24 h : envoyée, avec son échéance", () => {
    const r = memberStatus({ confirmation_sent_at: "2026-09-26T08:00:00.000Z" }, now);
    expect(r.status).toBe("invited");
    expect(r.inviteExpiresAt).toBe("2026-09-27T08:00:00.000Z");
  });

  it("invitation de plus de 24 h : expirée", () => {
    expect(memberStatus({ invited_at: "2026-09-24T08:00:00.000Z" }, now).status).toBe(
      "invite_expired",
    );
  });

  it("le dernier renvoi compte, pas la première invitation", () => {
    expect(
      memberStatus(
        {
          invited_at: "2026-09-20T08:00:00.000Z",
          confirmation_sent_at: "2026-09-26T11:00:00.000Z",
        },
        now,
      ).status,
    ).toBe("invited");
  });

  it("banni : désactivé, quel que soit le reste", () => {
    expect(
      memberStatus(
        { email_confirmed_at: "2026-09-01T00:00:00Z", banned_until: "2126-01-01T00:00:00Z" },
        now,
      ).status,
    ).toBe("disabled");
  });
});
