import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/* ============================================================
   GARDE-FOU : aucune URL absolue dérivée de la requête.

   Ce test balaie le source, ce qui est inhabituel — mais c'est ici le SEUL
   moyen d'attraper la faute. Le code fautif compile, passe les types et
   fonctionne parfaitement en développement : `request.nextUrl.origin` y vaut
   « http://localhost:3001 ». Ce n'est qu'en production, dans le conteneur, que
   Next se rabat sur HOSTNAME et PORT et produit « https://0.0.0.0:3000 ».

   Ce qui s'est produit le 4 août 2026 : un praticien a cliqué « Gérer mon
   abonnement », son jeton à usage unique a été consommé, puis la redirection
   l'a envoyé sur une adresse injoignable. Sans jeton, sans rattrapage.

   Deux des emplacements couverts ici scellent leur URL dans le MAC envoyé à
   Monetico : une origine fausse y renverrait un client APRÈS l'avoir débité.
   ============================================================ */

/** Fichiers où une URL absolue fausse a une conséquence sur un client. */
const GUARDED = [
  "src/proxy.ts",
  "src/app/(portail)/mon-abonnement/entrer/route.ts",
  "src/app/api/portal/subscribe/route.ts",
  "src/app/api/draft/enable/route.ts",
  "src/app/api/draft/disable/route.ts",
  "src/lib/billing/orders.ts",
  "src/lib/stripe/checkout.ts",
  "src/lib/stripe/subscription.ts",
  "src/lib/billing/portal.ts",
];

/** Retire les commentaires : ils PARLENT du motif interdit, exprès. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("aucune URL absolue dérivée de la requête", () => {
  for (const file of GUARDED) {
    it(file, () => {
      const code = stripComments(
        readFileSync(join(process.cwd(), file), "utf8"),
      );

      // request.nextUrl.origin / req.nextUrl.origin
      expect(code).not.toMatch(/nextUrl\s*\.\s*origin/);
      // new URL(<quoi que ce soit>, request.url)
      expect(code).not.toMatch(/new URL\([^)]*\breq(uest)?\.url\b/);
      // nextUrl.host / .hostname / .protocol comme base d'URL
      expect(code).not.toMatch(/nextUrl\s*\.\s*(host|hostname|protocol)\b/);
      // en-têtes d'hôte : jamais une source d'origine de confiance ici
      expect(code).not.toMatch(/["'](x-forwarded-host|host)["']/);
    });
  }
});

describe("siteOrigin", () => {
  it("retire la barre oblique finale", async () => {
    const previous = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://exemple.fr/";
    try {
      const { siteOrigin, siteUrl } = await import("./site-url");
      expect(siteOrigin()).toBe("https://exemple.fr");
      expect(siteUrl("/mon-abonnement")).toBe("https://exemple.fr/mon-abonnement");
      // Chemin sans barre initiale : on la remet plutôt que de coller.
      expect(siteUrl("admin")).toBe("https://exemple.fr/admin");
    } finally {
      process.env.NEXT_PUBLIC_SITE_URL = previous;
    }
  });

  it("se rabat sur le domaine public quand la variable est absente", async () => {
    /* Cas RÉEL de la production : le stage runner du Dockerfile ne pose pas
       NEXT_PUBLIC_SITE_URL. Le repli doit donner le bon domaine, jamais
       l'adresse de bind du conteneur. */
    const previous = process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    try {
      const { siteOrigin } = await import("./site-url");
      expect(siteOrigin()).toBe("https://medicarepro.fr");
    } finally {
      if (previous !== undefined) process.env.NEXT_PUBLIC_SITE_URL = previous;
    }
  });
});
