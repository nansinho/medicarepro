import { beforeAll, describe, expect, it, vi } from "vitest";

/* ============================================================
   Session de l'espace abonnement.

   Ce que ces tests protègent : la session est un COOKIE CHIFFRÉ, sans table
   de sessions. Trois propriétés portent toute la sécurité du portail, et
   aucune ne doit se perdre au fil des refactorings :
     1. le cookie est opaque (il ne laisse pas fuiter l'identifiant du cabinet
        à quiconque lit les cookies d'un navigateur partagé) ;
     2. il est infalsifiable (toute altération casse le déchiffrement, on ne
        se retrouve donc jamais avec la session d'un autre cabinet) ;
     3. il EXPIRE — c'est précisément ce qui manque au jeton de renouvellement
        historique, et la raison pour laquelle on ne l'a pas réutilisé.
   ============================================================ */

beforeAll(() => {
  process.env.ENCRYPTION_KEYS ??=
    "v1:kQwuPSJxHdPKiuAsJP9czsDgs9BCpsTxDN0ryZqaWSM=";
  process.env.NEXT_PUBLIC_SITE_URL ??= "https://medicarepro.fr";
});

const CABINET = "cmrg49kym001pizc12p1cnkg5";

const link = {
  id: "1f0c2f5a-0000-4000-8000-000000000001",
  jti: "2f0c2f5a-0000-4000-8000-000000000002",
  app_cabinet_id: CABINET,
  app_user_id: "user-1",
  cabinet: {
    name: "Cabinet Test",
    email: "contact@cabinet-test.fr",
    address: "12 rue de la Santé",
    postalCode: "75014",
    city: "Paris",
    invoicePrefix: "TES",
    adminEmail: "jean@cabinet-test.fr",
    adminName: "Jean Dupont",
  },
  expires_at: new Date(Date.now() + 60_000).toISOString(),
  consumed_at: null,
};

describe("session du portail", () => {
  it("fait l'aller-retour et rend le cabinet", async () => {
    const { sealSession, openSession, sessionFromLink } = await import("./portal");
    const sealed = sealSession(sessionFromLink(link));

    expect(sealed).not.toContain(CABINET); // opaque
    const session = openSession(sealed);
    expect(session?.appCabinetId).toBe(CABINET);
    expect(session?.cabinet.name).toBe("Cabinet Test");
  });

  it("refuse un cookie absent, vide ou altéré", async () => {
    const { sealSession, openSession, sessionFromLink } = await import("./portal");
    const sealed = sealSession(sessionFromLink(link));

    expect(openSession(undefined)).toBeNull();
    expect(openSession("")).toBeNull();
    expect(openSession("n'importe quoi")).toBeNull();
    // Une altération d'un seul caractère doit suffire.
    const tampered = sealed.slice(0, -2) + (sealed.endsWith("A") ? "B" : "A");
    expect(openSession(tampered)).toBeNull();
  });

  it("refuse une session expirée", async () => {
    const { sealSession, openSession } = await import("./portal");
    const sealed = sealSession({
      appCabinetId: CABINET,
      appUserId: null,
      cabinet: link.cabinet,
      exp: Date.now() - 1,
    });
    expect(openSession(sealed)).toBeNull();
  });

  it("expire réellement au terme annoncé", async () => {
    vi.useFakeTimers();
    try {
      const { sealSession, openSession, sessionFromLink, SESSION_TTL_MINUTES } =
        await import("./portal");
      const sealed = sealSession(sessionFromLink(link));
      expect(openSession(sealed)).not.toBeNull();

      vi.advanceTimersByTime((SESSION_TTL_MINUTES + 1) * 60_000);
      expect(openSession(sealed)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("ne se laisse pas ouvrir par un jeton de lien d'entrée", async () => {
    /* Les deux jetons partagent le même mécanisme de chiffrement : seule
       l'AAD les distingue. Sans elle, un lien d'entrée (public, dans une URL)
       vaudrait session. */
    const { openSession } = await import("./portal");
    const { encryptSecret } = await import("@/lib/crypto");
    const linkToken = encryptSecret(link.jti, "portal-link");
    expect(openSession(linkToken)).toBeNull();
  });
});
