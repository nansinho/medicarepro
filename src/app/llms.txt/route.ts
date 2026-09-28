import { SEO_DEFAULTS } from "@/data/content/site";
import { getPublishedCities } from "@/lib/cms/cities";

/* ============================================================
   /llms.txt : présentation du site pour les moteurs de réponse IA
   (convention llmstxt.org). Faits produit identiques au site, pages
   principales avec leur description SEO, pages villes publiées.
   ============================================================ */

export const revalidate = 3600;

const SITE = "https://medicarepro.fr";

/** Pages principales, dans l'ordre de lecture. */
const PAGES: { path: keyof typeof SEO_DEFAULTS; label: string }[] = [
  { path: "/", label: "Accueil" },
  { path: "/fonctionnalites", label: "Fonctionnalités" },
  { path: "/bilans", label: "Bilans podologiques" },
  { path: "/tarifs", label: "Tarifs" },
  { path: "/securite", label: "Sécurité et hébergement HDS" },
  { path: "/avantages", label: "Avantages" },
  { path: "/a-propos", label: "À propos" },
  { path: "/blog", label: "Blog" },
  { path: "/contact", label: "Contact et démonstration" },
];

/** Au-delà, la liste des villes renvoie à la page Partout en France. */
const MAX_CITIES = 300;

export async function GET(): Promise<Response> {
  const cities = await getPublishedCities();
  const lines = [
    "# MediCare Pro",
    "",
    "> Logiciel de gestion de cabinet pour les pédicures-podologues en France : dossiers patients, 13 bilans podologiques normés (pied diabétique, chutes, posturologie, sport, pédiatrie), facturation avec carte Vitale et ApCV, agenda en ligne avec rappels SMS et e-mail, comptabilité avec export FEC, signature électronique eIDAS, application sur mobile et tablette. Hébergement certifié HDS en France chez OVHcloud, conforme RGPD. À partir de 24,84 € par mois.",
    "",
    "## Pages principales",
    "",
    ...PAGES.map(({ path, label }) => {
      const seo = SEO_DEFAULTS[path] as { description?: string } | undefined;
      return `- [${label}](${SITE}${path === "/" ? "" : path})${seo?.description ? `: ${seo.description}` : ""}`;
    }),
  ];

  if (cities.length > 0) {
    lines.push(
      "",
      "## Partout en France",
      "",
      `Pages locales : nombre de pédicures-podologues par ville (Annuaire Santé, RPPS) et population (INSEE). Index : ${SITE}/logiciel-podologue`,
      "",
    );
    if (cities.length <= MAX_CITIES) {
      lines.push(...cities.map((c) => `- [${c.name}](${SITE}/logiciel-podologue/${c.slug}) (${c.region})`));
    }
  }

  return new Response(`${lines.join("\n")}\n`, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
