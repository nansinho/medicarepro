import { afterEach, describe, expect, it } from "vitest";
import { lireInterrupteur } from "@/lib/inscription-dans-app";
import {
  appRegisterUrl,
  registerUrl,
  resolveHref,
  vitrineRegisterUrl,
} from "@/lib/appLinks";

/* ============================================================
   Liens d'inscription et interrupteur INSCRIPTION_DANS_APP.

   Ce que ces tests protègent : le jour de la bascule, TOUS les boutons
   « S'inscrire » du site (CTA du contenu CMS inclus) doivent mener à
   l'application, avec la formule choisie ; et tant que l'interrupteur est
   coupé, rien ne doit changer pour les visiteurs.
   ============================================================ */

afterEach(() => {
  delete process.env.INSCRIPTION_DANS_APP;
});

describe("lireInterrupteur", () => {
  it("n'allume que sur une valeur explicitement vraie", () => {
    expect(lireInterrupteur(undefined)).toBe(false);
    expect(lireInterrupteur("")).toBe(false);
    expect(lireInterrupteur("false")).toBe(false);
    expect(lireInterrupteur("non")).toBe(false);
    expect(lireInterrupteur("0")).toBe(false);
    expect(lireInterrupteur("true")).toBe(true);
    expect(lireInterrupteur("1")).toBe(true);
    expect(lireInterrupteur("oui")).toBe(true);
  });

  it("tolère guillemets, espaces et casse, comme PAYMENT_PROVIDER", () => {
    expect(lireInterrupteur(' "TRUE" ')).toBe(true);
    expect(lireInterrupteur("'True'")).toBe(true);
    expect(lireInterrupteur(" false ")).toBe(false);
  });
});

describe("registerUrl", () => {
  it("mène au tunnel de la vitrine tant que l'interrupteur est coupé", () => {
    expect(registerUrl()).toBe("/inscription");
    expect(registerUrl("annual")).toBe("/inscription?plan=annual");
    expect(registerUrl("monthly")).toBe("/inscription?plan=monthly");
  });

  it("mène à l'application, formule comprise, une fois l'interrupteur allumé", () => {
    process.env.INSCRIPTION_DANS_APP = "true";
    expect(registerUrl()).toBe("https://app.medicarepro.fr/register");
    expect(registerUrl("annual")).toBe("https://app.medicarepro.fr/register?plan=annual");
    expect(registerUrl("monthly")).toBe("https://app.medicarepro.fr/register?plan=monthly");
  });

  it("lit l'interrupteur à chaque appel, pas au chargement du module", () => {
    expect(registerUrl("annual")).toBe("/inscription?plan=annual");
    process.env.INSCRIPTION_DANS_APP = "true";
    expect(registerUrl("annual")).toBe("https://app.medicarepro.fr/register?plan=annual");
    process.env.INSCRIPTION_DANS_APP = "false";
    expect(registerUrl("annual")).toBe("/inscription?plan=annual");
  });

  it("expose les deux destinations telles quelles", () => {
    expect(vitrineRegisterUrl("annual")).toBe("/inscription?plan=annual");
    expect(appRegisterUrl("annual")).toBe("https://app.medicarepro.fr/register?plan=annual");
    expect(appRegisterUrl()).toBe("https://app.medicarepro.fr/register");
  });
});

describe("resolveHref", () => {
  it("suit registerUrl pour les clés app:register*", () => {
    expect(resolveHref("app:register")).toBe("/inscription");
    expect(resolveHref("app:register:annual")).toBe("/inscription?plan=annual");
    process.env.INSCRIPTION_DANS_APP = "true";
    expect(resolveHref("app:register")).toBe("https://app.medicarepro.fr/register");
    expect(resolveHref("app:register:monthly")).toBe(
      "https://app.medicarepro.fr/register?plan=monthly",
    );
  });

  it("laisse passer la connexion et les liens ordinaires", () => {
    process.env.INSCRIPTION_DANS_APP = "true";
    expect(resolveHref("app:login")).toBe("https://app.medicarepro.fr/login");
    expect(resolveHref("/tarifs")).toBe("/tarifs");
    expect(resolveHref("https://exemple.fr/x")).toBe("https://exemple.fr/x");
    expect(resolveHref("#")).toBe("#");
  });
});
