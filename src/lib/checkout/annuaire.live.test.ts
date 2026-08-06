import { describe, expect, it } from "vitest";
import { suggestSiret, verifySiret } from "./annuaire";

/* Vérification CONTRE L'ANNUAIRE RÉEL. Hors CI (réseau + quota de
   l'État) : `set ANNUAIRE_LIVE=1` pour la jouer. */
const live = process.env.ANNUAIRE_LIVE === "1";

describe.skipIf(!live)("annuaire réel", () => {
  it("guide la saisie de 7 à 14 chiffres", { timeout: 60_000 }, async () => {
    const SIRET = "79249243100681"; // ALLO OSTEOPATHES, Saint-Germain-en-Laye

    const sept = await suggestSiret(SIRET.slice(0, 7));
    console.log(
      `7 chiffres → ${sept.items.length} propositions :`,
      sept.items.map((i) => `${i.siret} ${i.name} (${i.city})`),
    );
    expect(sept.status).toBe("ok");
    expect(sept.items.length).toBeGreaterThan(1);

    const huit = await suggestSiret(SIRET.slice(0, 8));
    console.log(
      `8 chiffres → ${huit.items.length} :`,
      huit.items.map((i) => `${i.siret} ${i.name}`),
    );
    expect(huit.items.length).toBeLessThan(sept.items.length);
    expect(huit.items.some((i) => i.siret.startsWith(SIRET.slice(0, 9)))).toBe(
      true,
    );

    const treize = await suggestSiret(SIRET.slice(0, 13));
    console.log(
      `13 chiffres → ${treize.items.length} :`,
      treize.items.map((i) => `${i.siret} ${i.name} (${i.city})`),
    );
    expect(treize.items.map((i) => i.siret)).toContain(SIRET);

    const verdict = await verifySiret(SIRET);
    console.log("14 chiffres → verdict :", verdict.status, verdict.data);
    expect(verdict.status).toBe("active");
  });

  it("corrige un chiffre faux et refuse un numéro inexistant", async () => {
    const faux = await suggestSiret("792492432"); // clé fausse
    console.log(
      "SIREN fautif → corrections :",
      faux.items.map((i) => `${i.siret} ${i.name}`),
    );
    expect(faux.didYouMean).toBe(true);
    expect(faux.items.some((i) => i.siret.startsWith("792492431"))).toBe(true);

    // Luhn valide mais jamais attribué.
    const verdict = await verifySiret("00000000000000");
    console.log("SIRET inexistant → verdict :", verdict.status);
    expect(verdict.status).toBe("not_found");
  }, 60_000);

  it("reconnaît une école de podologie (elles ont bien un SIRET)", async () => {
    const verdict = await verifySiret("77774615700091"); // IFPEK, Rennes
    console.log("École → verdict :", verdict.status, verdict.data?.name);
    expect(verdict.status).toBe("active");
  }, 30_000);
});
