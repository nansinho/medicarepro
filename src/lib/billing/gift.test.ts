import { describe, expect, it } from "vitest";
import {
  addGiftMonths,
  giftDisplayState,
  hashGiftToken,
  isGiftTokenShape,
  newGiftToken,
  parseGiftDraft,
} from "@/lib/billing/gift";

/* ============================================================
   Accès offerts : le socle.

   Deux choses coûtent cher ici. Un lien qui se devine ou se reconstruit
   depuis la base ouvrirait des comptes gratuits à n'importe qui. Et une date
   de fin mal calculée prive un gagnant de ses jours offerts, ou lui en donne
   un mois de trop.
   ============================================================ */

describe("jeton du lien", () => {
  it("a la forme attendue et ne se retrouve pas dans son empreinte", () => {
    const { token, hash } = newGiftToken();
    expect(isGiftTokenShape(token)).toBe(true);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashGiftToken(token)).toBe(hash);
  });

  it("n'est jamais deux fois le même", () => {
    const vus = new Set(Array.from({ length: 200 }, () => newGiftToken().token));
    expect(vus.size).toBe(200);
  });

  it("refuse les formes bricolées avant toute requête", () => {
    for (const faux of ["", "abc", "x".repeat(44), "a b".padEnd(43, "c"), 42, null]) {
      expect(isGiftTokenShape(faux)).toBe(false);
    }
  });
});

describe("addGiftMonths — le jour du mois borné", () => {
  it("six mois après le 31 août tombent fin février, pas début mars", () => {
    const fin = addGiftMonths(new Date("2026-08-31T10:00:00Z"), 6);
    expect(fin.toISOString()).toBe("2027-02-28T10:00:00.000Z");
  });

  it("trois mois après le 26 septembre tombent le 26 décembre", () => {
    const fin = addGiftMonths(new Date("2026-09-26T14:30:00Z"), 3);
    expect(fin.toISOString()).toBe("2026-12-26T14:30:00.000Z");
  });

  it("passe l'année", () => {
    expect(addGiftMonths(new Date("2026-11-15T00:00:00Z"), 12).toISOString()).toBe(
      "2027-11-15T00:00:00.000Z",
    );
  });
});

describe("parseGiftDraft — la saisie du back-office", () => {
  const ok = { email: " Guilhaume.Lejeune@Gmail.com ", months: "6", reason: "Quiz de l'été 2026", requireCard: "no" };

  it("normalise l'adresse, qui deviendra un identifiant", () => {
    const r = parseGiftDraft(ok);
    expect(r).toEqual({
      ok: true,
      draft: {
        email: "guilhaume.lejeune@gmail.com",
        months: 6,
        reason: "Quiz de l'été 2026",
        requireCard: false,
      },
    });
  });

  it("n'a AUCUNE valeur par défaut pour la fin de période", () => {
    const r = parseGiftDraft({ ...ok, requireCard: null });
    expect(r).toMatchObject({ ok: false, field: "requireCard" });
    expect(parseGiftDraft({ ...ok, requireCard: "on" })).toMatchObject({ ok: false });
  });

  it("borne la durée entre 1 et 12 mois", () => {
    expect(parseGiftDraft({ ...ok, months: "0" })).toMatchObject({ ok: false, field: "months" });
    expect(parseGiftDraft({ ...ok, months: "13" })).toMatchObject({ ok: false, field: "months" });
    expect(parseGiftDraft({ ...ok, months: "12" })).toMatchObject({ ok: true });
  });

  it("exige une adresse et un motif", () => {
    expect(parseGiftDraft({ ...ok, email: "pas-une-adresse" })).toMatchObject({ field: "email" });
    expect(parseGiftDraft({ ...ok, reason: " " })).toMatchObject({ field: "reason" });
  });
});

describe("giftDisplayState — ce que le back-office affiche", () => {
  const maintenant = new Date("2026-10-01T12:00:00Z");
  const valide = { status: "pending" as const, expires_at: "2026-11-01T00:00:00Z" };

  it("distingue une invitation en attente d'un lien périmé", () => {
    expect(giftDisplayState(valide, null, maintenant)).toBe("pending");
    expect(
      giftDisplayState({ ...valide, expires_at: "2026-09-30T00:00:00Z" }, null, maintenant),
    ).toBe("link_expired");
  });

  it("suit le contrat une fois l'accès ouvert", () => {
    const utilisee = { status: "claimed" as const, expires_at: valide.expires_at };
    expect(giftDisplayState(utilisee, null, maintenant)).toBe("opening");
    expect(
      giftDisplayState(utilisee, { status: "active", gift_ends_at: "2027-03-01T00:00:00Z", renewal_count: 0 }, maintenant),
    ).toBe("active");
    expect(
      giftDisplayState(utilisee, { status: "active", gift_ends_at: "2027-03-01T00:00:00Z", renewal_count: 1 }, maintenant),
    ).toBe("converted");
    expect(
      giftDisplayState(utilisee, { status: "expired", gift_ends_at: "2027-03-01T00:00:00Z", renewal_count: 0 }, maintenant),
    ).toBe("ended");
  });

  it("une invitation retirée reste retirée", () => {
    expect(giftDisplayState({ ...valide, status: "revoked" }, null, maintenant)).toBe("revoked");
  });
});
