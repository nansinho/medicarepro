import { beforeAll, describe, expect, it } from "vitest";

/* Le chiffrement du jeton lit ENCRYPTION_KEYS : on le fixe avant l'import. */
beforeAll(() => {
  if (!process.env.ENCRYPTION_KEYS) {
    process.env.ENCRYPTION_KEYS =
      "v1:kQwuPSJxHdPKiuAsJP9czsDgs9BCpsTxDN0ryZqaWSM=";
  }
  process.env.NEXT_PUBLIC_SITE_URL ??= "https://medicarepro.fr";
});

describe("jeton de renouvellement", () => {
  const SUB = "3f9a1c2e-1234-4abc-8def-0123456789ab";

  it("fait l'aller-retour signer → vérifier", async () => {
    const { signRenewalToken, verifyRenewalToken } = await import("./renewal-link");
    const token = signRenewalToken(SUB);
    expect(token).not.toContain(SUB); // opaque : n'expose pas l'id
    expect(verifyRenewalToken(token)).toBe(SUB);
  });

  it("rejette un jeton falsifié ou vide", async () => {
    const { signRenewalToken, verifyRenewalToken } = await import("./renewal-link");
    const token = signRenewalToken(SUB);
    expect(verifyRenewalToken(token.slice(0, -2) + "XY")).toBeNull();
    expect(verifyRenewalToken("n'importe quoi")).toBeNull();
    expect(verifyRenewalToken("")).toBeNull();
  });

  it("construit une URL de renouvellement avec le jeton", async () => {
    const { buildRenewalUrl, verifyRenewalToken } = await import("./renewal-link");
    const url = buildRenewalUrl(SUB);
    expect(url.startsWith("https://medicarepro.fr/renouvellement?t=")).toBe(true);
    const t = decodeURIComponent(new URL(url).searchParams.get("t") ?? "");
    expect(verifyRenewalToken(t)).toBe(SUB);
  });

  it("génère une référence Monetico valide (MP + 10)", async () => {
    const { newRenewalReference } = await import("./renewal-link");
    expect(newRenewalReference()).toMatch(/^MP[0-9A-Z]{10}$/);
  });
});
