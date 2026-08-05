import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/* ============================================================
   GARDE-FOU : tout formulaire de paiement route son TPE par le PLAN.

   MediCare Pro encaisse sur deux TPE. Le code site du récurrent (NB8179R)
   porte une périodicité MENSUELLE : c'est lui qui décide que la banque
   reprélèvera, pas la commande. Envoyer une offre 12 mois sur ce TPE ne
   produit donc pas une erreur — cela produit un abonnement mensuel au prix
   de l'année.

   Ce qui s'est produit le 5 août 2026 : la route de relance reprenait le TPE
   récurrent en dur. Trois relances d'une offre 12 mois à 478,08 € sont parties
   sur NB8179R (références MPW6J1QVJ4P7, MP7WEVH8JM3V, MP44K6ZA2Q7A, visibles
   dans ipn_events). Le client n'a été sauvé que par le refus de sa banque.

   Aucun test de comportement ne pouvait l'attraper : le formulaire produit est
   valide, scellé, accepté par Monetico. Seul le TPE est le mauvais, et il ne
   se lit que sur le relevé du client. D'où ce balayage du source.
   ============================================================ */

/** Toute route qui construit un formulaire de paiement Monetico. */
const BUILDERS = [
  "src/app/api/checkout/route.ts",
  "src/app/api/checkout/retry/route.ts",
  "src/app/api/checkout/renew/route.ts",
  "src/lib/billing/orders.ts",
];

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function read(relativePath: string): string {
  return stripComments(
    readFileSync(join(process.cwd(), relativePath), "utf8"),
  );
}

describe("routage des TPE Monetico", () => {
  it.each(BUILDERS)("%s passe par moneticoConfigForPlan", (file) => {
    const source = read(file);
    expect(source).toContain("buildPaymentForm(");
    expect(source).toContain("moneticoConfigForPlan(");
  });

  it.each(BUILDERS)("%s ne compose aucune config de TPE à la main", (file) => {
    const source = read(file);
    /* Le seul endroit autorisé à lire ces champs est monetico-routing.ts.
       Ailleurs, les assembler revient à choisir un TPE sans regarder le plan. */
    expect(source).not.toMatch(/tpe:\s*\w+\.moneticoTpe\b/);
    expect(source).not.toMatch(/key:\s*\w+\.moneticoKey\b/);
    expect(source).not.toMatch(/societe:\s*\w+\.moneticoSociete\b/);
  });

  it("seul monetico-routing.ts choisit un TPE", () => {
    const routing = read("src/lib/billing/monetico-routing.ts");
    expect(routing).toMatch(/tpe:\s*b\.moneticoTpeImmediate/);
    expect(routing).toMatch(/tpe:\s*b\.moneticoTpe\b/);
  });
});

/* ============================================================
   Adresses de retour : jamais la même pour l'accepté et le refusé.

   CE QUE CE TEST EMPÊCHE DE REVENIR : les quatre points d'entrée envoyaient
   la MÊME adresse dans `url_retour_ok` et `url_retour_err`. Monetico l'a
   relevé sur le contrat, et l'effet côté client était pire que le manquement
   de conformité : une carte refusée renvoyait sur un écran de remerciement.

   Le test lit la source plutôt que d'exécuter les routes, parce que c'est
   l'écriture `urlRetourErr: returnUrl` qu'il faut interdire — une fois le
   formulaire construit, l'erreur n'est plus détectable autrement qu'en
   comparant deux chaînes qui, elles, sont correctes par construction.
   ============================================================ */

describe("adresses de retour Monetico", () => {
  it.each(BUILDERS)("%s distingue le retour accepté du retour refusé", (file) => {
    const source = read(file);
    // La faute exacte : la même variable des deux côtés.
    expect(source).not.toMatch(/urlRetourErr:\s*returnUrl\b/);
    expect(source).toMatch(/urlRetourErr:\s*\w+/);
  });

  it("openOrder EXIGE un chemin d'échec de son appelant", () => {
    /* Optionnel avec un défaut, il serait oublié au prochain parcours de
       paiement, et le client refusé retomberait sur « merci ». */
    const source = read("src/lib/billing/orders.ts");
    expect(source).toMatch(/^\s*errorPath: string;/m);
    expect(source).not.toMatch(/errorPath\?:/);
  });
});
