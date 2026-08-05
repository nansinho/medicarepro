import { describe, expect, it } from "vitest";
import { CabinetSchema } from "./schema";
import {
  APP_REQUIRED_CABINET_FIELDS,
  buildProvisioningCabinet,
} from "@/lib/provisioning";

/* ============================================================
   Garde-fou du contrat de provisioning.

   Deux vrais clients ont payé puis vu leur compte refusé parce
   qu'un champ facultatif dans notre tunnel était EXIGÉ par l'app
   (rppsNumber, puis phone). Ces tests garantissent que ça ne
   se reproduit plus SANS être détecté :

   1. tout champ que l'app exige est produit non vide par la
      correspondance dossier → payload ;
   2. le schéma du tunnel refuse ces champs vides (sauf le fixe,
      couvert par le repli sur le portable).

   Si quelqu'un desserre le schéma ou casse le repli, un de ces
   tests tombe AVANT la mise en production.
   ============================================================ */

/** Dossier cabinet minimal, valide au sens du schéma du tunnel. */
const validCabinet = {
  name: "Cabinet Test",
  email: "cabinet@example.fr",
  phone: "", // fixe volontairement vide : cas réel le plus fréquent
  mobilePhone: "0647726926",
  address: "1 rue de la Test",
  city: "Aix-en-Provence",
  postalCode: "13100",
  siretNumber: "81069609600017", // Luhn valide
  rppsNumber: "12345678901",
};

describe("contrat de provisioning — aucun champ requis ne part vide", () => {
  it("un dossier valide produit un payload cabinet complet", () => {
    const parsed = CabinetSchema.parse(validCabinet);
    const payload = buildProvisioningCabinet(parsed, "MP-TEST");
    for (const field of APP_REQUIRED_CABINET_FIELDS) {
      const value = String(
        (payload as Record<string, unknown>)[field] ?? "",
      ).trim();
      expect(value, `champ « ${field} » vide dans le payload`).not.toBe("");
    }
  });

  it("sans téléphone fixe, le portable prend le relais", () => {
    const parsed = CabinetSchema.parse({ ...validCabinet, phone: "" });
    const payload = buildProvisioningCabinet(parsed, "MP-TEST");
    expect(payload.phone).toBe("0647726926");
  });

  it("un fixe renseigné est conservé tel quel", () => {
    const parsed = CabinetSchema.parse({ ...validCabinet, phone: "0442000000" });
    const payload = buildProvisioningCabinet(parsed, "MP-TEST");
    expect(payload.phone).toBe("0442000000");
  });

  it("le schéma refuse tout champ requis vide (hors fixe, couvert par le repli)", () => {
    const requiredInTunnel = [
      "name",
      "email",
      "mobilePhone",
      "address",
      "city",
      "postalCode",
      "siretNumber",
      "rppsNumber",
    ] as const;
    for (const field of requiredInTunnel) {
      const bad = { ...validCabinet, [field]: "" };
      expect(
        CabinetSchema.safeParse(bad).success,
        `« ${field} » vide devrait être refusé par le schéma`,
      ).toBe(false);
    }
  });
});

/* ============================================================
   Deux conventions pour une même notion.

   Chez nous, minuscules : colonne `payment_provider`, variable
   `PAYMENT_PROVIDER`. Dans le contrat avec l'application métier, MAJUSCULES,
   depuis toujours. C'est le genre d'écart qui produit un refus
   incompréhensible le jour du premier vrai paiement.

   Et une précision de l'équipe de l'application, le 05/08/2026 : le champ
   n'est pas une énumération stricte de leur côté, mais une valeur ABSENTE est
   enregistrée « MONETICO » par défaut. Un paiement Stripe muet serait donc
   comptabilisé chez eux comme un paiement Monetico — d'où l'importance de
   toujours l'envoyer, et de ne jamais renvoyer undefined.
   ============================================================ */
describe("providerForApp", () => {
  it("traduit vers la convention du contrat", async () => {
    const { providerForApp } = await import("@/lib/provisioning");
    expect(providerForApp("stripe")).toBe("STRIPE");
    expect(providerForApp("monetico")).toBe("MONETICO");
  });

  /* Les lignes antérieures à la migration 0034 ont la colonne à NULL : elles
     ont toutes été encaissées par Monetico. */
  it("rattache l'inconnu à Monetico, jamais à rien", async () => {
    const { providerForApp } = await import("@/lib/provisioning");
    expect(providerForApp(null)).toBe("MONETICO");
    expect(providerForApp(undefined)).toBe("MONETICO");
  });
});
