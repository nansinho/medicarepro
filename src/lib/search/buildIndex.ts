import { getPageSections } from "@/lib/cms/pages";
import { getFaqItems, getFeatureItems } from "@/lib/cms/collections";
import { getPosts } from "@/lib/cms/posts";

/* ============================================================
   Index de recherche du site : agrège tout le contenu public
   (pages gérées, fiches fonctionnalités/bilans, articles, FAQ)
   en entrées plates { titre, url, texte }. Le filtrage se fait
   côté client (overlay de recherche) — l'index reste petit.
   Les fetchers CMS sous-jacents sont déjà cachés (unstable_cache).
   ============================================================ */

export type SearchEntryKind = "page" | "article" | "faq";

export type SearchEntry = {
  kind: SearchEntryKind;
  title: string;
  /** Chemin interne ("/tarifs", "/blog/slug"). */
  url: string;
  /** Texte brut concaténé dans lequel chercher. */
  text: string;
};

/** Pages gérées (slug CMS = chemin URL) et leur titre de résultat. */
const PAGES: { slug: string; title: string }[] = [
  { slug: "/", title: "Accueil" },
  { slug: "/fonctionnalites", title: "Fonctionnalités" },
  { slug: "/bilans", title: "Bilans" },
  { slug: "/securite", title: "Sécurité" },
  { slug: "/avantages", title: "Avantages" },
  { slug: "/tarifs", title: "Tarifs" },
  { slug: "/contact", title: "Contact" },
  { slug: "/a-propos", title: "À propos" },
  { slug: "/cgu", title: "Conditions générales d'utilisation" },
  { slug: "/mentions-legales", title: "Mentions légales" },
  { slug: "/confidentialite", title: "Politique de confidentialité" },
];

/** Clés des sections dont la valeur string n'est pas de la prose. */
const SKIP_KEYS = new Set([
  "type",
  "href",
  "teaserHref",
  "hrefLabel",
  "icon",
  "mockup",
  "mediaId",
  "path",
  "alt",
  "imagePos",
  "collection",
  "tones",
  "image",
  "url",
]);

/** Ressemble à un lien/chemin plutôt qu'à du texte lisible. */
const LINK_LIKE = /^(\/|#|https?:|app:|mailto:|tel:)/;

/** Aplatit les retours à la ligne de mise en forme du contenu CMS. */
const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** Collecte récursivement les strings « prose » d'un contenu de section. */
function collectText(value: unknown, out: string[]): void {
  if (typeof value === "string") {
    const s = clean(value);
    if (s.length < 3 || LINK_LIKE.test(s)) return;
    out.push(s);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectText(item, out);
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (SKIP_KEYS.has(key)) continue;
      collectText(child, out);
    }
  }
}

/** Construit l'index complet (contenu publié, fallbacks compris). */
export async function buildSearchIndex(): Promise<SearchEntry[]> {
  const [pages, posts, faqItems, features, bilans] = await Promise.all([
    Promise.all(
      PAGES.map(async (page) => ({
        ...page,
        sections: await getPageSections(page.slug),
      })),
    ),
    getPosts(),
    getFaqItems(),
    getFeatureItems("features"),
    getFeatureItems("bilans"),
  ]);

  const entries: SearchEntry[] = [];

  for (const page of pages) {
    const parts: string[] = [];
    for (const section of Object.values(page.sections)) {
      collectText(section, parts);
    }
    entries.push({
      kind: "page",
      title: page.title,
      url: page.slug,
      text: parts.join(" · "),
    });
  }

  /* Fiches détaillées : le contenu des collections n'apparaît pas dans les
     sections (qui n'en stockent que la référence), on les indexe à part. */
  for (const item of [...features, ...bilans]) {
    entries.push({
      kind: "page",
      title: clean(item.title),
      url: item.collection === "bilans" ? "/bilans" : "/fonctionnalites",
      text: clean([item.kicker, item.text, ...item.points].join(" · ")),
    });
  }

  for (const post of posts) {
    const parts: string[] = [post.excerpt];
    for (const section of post.sections) {
      if (section.heading) parts.push(section.heading);
      parts.push(...section.paragraphs);
      if (section.list) parts.push(...section.list);
    }
    entries.push({
      kind: "article",
      title: clean(post.title),
      url: `/blog/${post.slug}`,
      text: clean(parts.join(" ")),
    });
  }

  for (const item of faqItems) {
    entries.push({
      kind: "faq",
      title: clean(item.q),
      url: "/tarifs",
      text: clean(item.a),
    });
  }

  return entries;
}
