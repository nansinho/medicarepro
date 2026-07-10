/**
 * Génération de `supabase/seed.sql` depuis les modules de contenu TS.
 *
 * Usage : npx tsx scripts/generate-seed.ts   (depuis la racine du repo)
 *
 * Sources de vérité :
 *  - src/data/content/*            (11 pages gérées, collections, menus, settings, SEO)
 *  - src/data/blogPosts.ts         (3 articles → posts, conversion Tiptap)
 *  - scripts/data/cities-fr.csv    (~100 villes INSEE → cities + city_nearby)
 *  - public/images/**              (fichiers existants → rows media bucket 'legacy')
 *
 * Garanties :
 *  - UUID déterministes (uuidv5, namespace fixe) : re-générer produit un SQL
 *    identique octet pour octet (hors contenu source modifié) ;
 *  - chaque payload de section est validé par SectionContentSchema.parse
 *    (défauts appliqués, `_v` inclus) — échec = arrêt immédiat ;
 *  - échappement SQL par doublement des apostrophes (JSON via '…'::jsonb) ;
 *  - INSERTs simples dans une transaction unique : le seed cible une base
 *    FRAÎCHE (supabase db reset), pas de truncate ni d'upsert.
 */
import fs from "node:fs";
import path from "node:path";
import { v5 as uuidv5 } from "uuid";

import {
  SectionContentSchema,
  type ManagedPageContent,
  type SectionContent,
} from "../src/lib/cms/sections.schema";
import { PAGE_HOME } from "../src/data/content/home";
import { PAGE_FONCTIONNALITES } from "../src/data/content/fonctionnalites";
import { PAGE_BILANS } from "../src/data/content/bilans";
import { PAGE_SECURITE } from "../src/data/content/securite";
import { PAGE_AVANTAGES } from "../src/data/content/avantages";
import { PAGE_TARIFS } from "../src/data/content/tarifs";
import { PAGE_CONTACT } from "../src/data/content/contact";
import { PAGE_A_PROPOS } from "../src/data/content/a-propos";
import {
  PAGE_CGU,
  PAGE_MENTIONS,
  PAGE_CONFIDENTIALITE,
} from "../src/data/content/legal";
import {
  TESTIMONIALS,
  PRICING_PLANS,
  PRICING_EXAMPLES,
  FEATURE_ITEMS,
  FAQ_ITEMS,
} from "../src/data/content/collections";
import {
  MENUS,
  SETTINGS,
  SEO_DEFAULTS,
  JSONLD_ORG,
  JSONLD_SOFTWARE,
} from "../src/data/content/site";
import { BLOG_POSTS, type BlogSection } from "../src/data/blogPosts";

/* ------------------------------------------------------------------ */
/* Chemins                                                             */
/* ------------------------------------------------------------------ */

const ROOT = process.cwd();
if (!fs.existsSync(path.join(ROOT, "src", "data", "content"))) {
  throw new Error(
    "Lancez le script depuis la racine du repo : npx tsx scripts/generate-seed.ts",
  );
}
const IMAGES_DIR = path.join(ROOT, "public", "images");
const CSV_PATH = path.join(ROOT, "scripts", "data", "cities-fr.csv");
const OUT_PATH = path.join(ROOT, "supabase", "seed.sql");

/* ------------------------------------------------------------------ */
/* UUID déterministes                                                  */
/* ------------------------------------------------------------------ */

/** Namespace fixe du projet — NE JAMAIS CHANGER (stabilité des ids). */
const SEED_NAMESPACE = "b7a9c3d1-4e2f-4a6b-8c5d-0e1f2a3b4c5d";

const uid = (table: string, naturalKey: string): string =>
  uuidv5(`${table}:${naturalKey}`, SEED_NAMESPACE);

/* ------------------------------------------------------------------ */
/* Littéraux SQL                                                       */
/* ------------------------------------------------------------------ */

/** Littéral texte : apostrophes doublées (« L'équipe » → 'L''équipe'). */
const sqlString = (value: string): string => `'${value.replace(/'/g, "''")}'`;

/** Littéral jsonb : JSON.stringify échappé comme un texte, casté ::jsonb. */
const sqlJson = (value: unknown): string =>
  `${sqlString(JSON.stringify(value))}::jsonb`;

const sqlText = (value: string | null | undefined): string =>
  value == null ? "null" : sqlString(value);

const sqlNum = (value: number | null | undefined): string => {
  if (value == null) return "null";
  if (!Number.isFinite(value)) throw new Error(`Nombre invalide : ${value}`);
  return String(value);
};

const sqlBool = (value: boolean | null | undefined): string =>
  value ? "true" : "false";

/* ------------------------------------------------------------------ */
/* Pages gérées : validation zod stricte                               */
/* ------------------------------------------------------------------ */

const PAGES: ManagedPageContent[] = [
  PAGE_HOME,
  PAGE_FONCTIONNALITES,
  PAGE_BILANS,
  PAGE_SECURITE,
  PAGE_AVANTAGES,
  PAGE_TARIFS,
  PAGE_CONTACT,
  PAGE_A_PROPOS,
  PAGE_CGU,
  PAGE_MENTIONS,
  PAGE_CONFIDENTIALITE,
];

type ParsedSlot = { key: string; type: string; content: SectionContent };
type ParsedPage = { slug: string; title: string; sections: ParsedSlot[] };

const parsedPages: ParsedPage[] = PAGES.map((page) => ({
  slug: page.slug,
  title: page.title,
  sections: page.sections.map((slot) => {
    let content: SectionContent;
    try {
      // parse (PAS safeParse) : défauts appliqués (_v), échec = throw.
      content = SectionContentSchema.parse(slot.content);
    } catch (error) {
      throw new Error(
        `Payload invalide — page ${page.slug}, slot ${slot.key} (${slot.type}) :\n${String(error)}`,
      );
    }
    if (content.type !== slot.type) {
      throw new Error(
        `Type incohérent — page ${page.slug}, slot ${slot.key} : slot.type="${slot.type}" mais content.type="${content.type}"`,
      );
    }
    return { key: slot.key, type: slot.type, content };
  }),
}));

/* ------------------------------------------------------------------ */
/* Médias legacy : un row par fichier de public/images/**              */
/* ------------------------------------------------------------------ */

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

function listImageFiles(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...listImageFiles(path.join(dir, entry.name), rel));
    } else if (entry.isFile()) {
      out.push(rel);
    }
  }
  return out;
}

/** Chemins publics triés (déterminisme) : "/images/…". */
const imagePaths = listImageFiles(IMAGES_DIR)
  .map((rel) => `/images/${rel}`)
  .sort();

const mediaIdByPath = new Map<string, string>(
  imagePaths.map((p) => [p, uid("media", `legacy:${p}`)]),
);

/**
 * alt "best-effort" : première occurrence NON VIDE rencontrée dans le contenu
 * (pages gérées dans l'ordre, puis témoignages, puis articles), sinon ''.
 * Collecte aussi toutes les références d'images pour vérifier qu'elles
 * pointent vers un fichier existant.
 */
const altByPath = new Map<string, string>();
const referencedPaths = new Set<string>();

function collectImageRefs(node: unknown): void {
  if (Array.isArray(node)) {
    for (const item of node) collectImageRefs(item);
    return;
  }
  if (node !== null && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (
      typeof obj.path === "string" &&
      obj.path.startsWith("/images/") &&
      typeof obj.alt === "string"
    ) {
      referencedPaths.add(obj.path);
      if (obj.alt !== "" && !altByPath.has(obj.path)) {
        altByPath.set(obj.path, obj.alt);
      }
    }
    for (const value of Object.values(obj)) collectImageRefs(value);
  }
}

for (const page of parsedPages) {
  for (const slot of page.sections) collectImageRefs(slot.content);
}
for (const testimonial of TESTIMONIALS) collectImageRefs(testimonial.avatar);
for (const post of BLOG_POSTS) {
  referencedPaths.add(post.image);
  if (post.imageAlt && !altByPath.has(post.image)) {
    altByPath.set(post.image, post.imageAlt);
  }
}

for (const ref of [...referencedPaths].sort()) {
  if (!mediaIdByPath.has(ref)) {
    throw new Error(
      `Image référencée dans le contenu mais absente de public${ref}`,
    );
  }
}

/* ------------------------------------------------------------------ */
/* Blog : conversion BlogSection[] → document Tiptap                   */
/* ------------------------------------------------------------------ */

type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
};

const textNode = (value: string): TiptapNode => ({ type: "text", text: value });

/** doc > h2 (section.heading) / paragraph (par item) / bulletList>listItem>paragraph.
 *  Nœuds texte bruts, sans marks (le contenu source n'en utilise pas). */
function blogSectionsToTiptap(sections: BlogSection[]): {
  type: "doc";
  content: TiptapNode[];
} {
  const content: TiptapNode[] = [];
  for (const section of sections) {
    if (section.heading) {
      content.push({
        type: "heading",
        attrs: { level: 2 },
        content: [textNode(section.heading)],
      });
    }
    for (const paragraph of section.paragraphs) {
      content.push({ type: "paragraph", content: [textNode(paragraph)] });
    }
    if (section.list) {
      content.push({
        type: "bulletList",
        content: section.list.map((item) => ({
          type: "listItem",
          content: [{ type: "paragraph", content: [textNode(item)] }],
        })),
      });
    }
  }
  return { type: "doc", content };
}

function parseReadingTime(raw: string): number {
  const match = /^(\d+)\s*min$/.exec(raw.trim());
  if (!match) throw new Error(`readingTime illisible : "${raw}"`);
  return Number(match[1]);
}

/* ------------------------------------------------------------------ */
/* Villes : CSV + maillage des 5 plus proches (haversine)              */
/* ------------------------------------------------------------------ */

type CityRow = {
  slug: string;
  name: string;
  nameLocative: string;
  deptCode: string;
  deptName: string;
  region: string;
  population: number;
  lat: number;
  lng: number;
  wave: number;
};

function parseCitiesCsv(csvPath: string): CityRow[] {
  const raw = fs.readFileSync(csvPath, "utf8");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim() !== "");
  const header = lines[0];
  const expected =
    "slug,name,name_locative,dept_code,dept_name,region,population,lat,lng,wave";
  if (header !== expected) {
    throw new Error(`En-tête CSV inattendu :\n  ${header}\nattendu :\n  ${expected}`);
  }
  return lines.slice(1).map((line, i) => {
    const cols = line.split(",");
    if (cols.length !== 10) {
      throw new Error(`Ligne CSV ${i + 2} : ${cols.length} colonnes (attendu 10) — ${line}`);
    }
    const [slug, name, nameLocative, deptCode, deptName, region, population, lat, lng, wave] =
      cols;
    const row: CityRow = {
      slug,
      name,
      nameLocative,
      deptCode,
      deptName,
      region,
      population: Number(population),
      lat: Number(lat),
      lng: Number(lng),
      wave: Number(wave),
    };
    if (
      !row.slug ||
      !Number.isFinite(row.population) ||
      !Number.isFinite(row.lat) ||
      !Number.isFinite(row.lng) ||
      ![1, 2, 3].includes(row.wave)
    ) {
      throw new Error(`Ligne CSV ${i + 2} invalide : ${line}`);
    }
    return row;
  });
}

const cities = parseCitiesCsv(CSV_PATH);
{
  const slugs = new Set(cities.map((c) => c.slug));
  if (slugs.size !== cities.length) {
    throw new Error("Slugs de villes dupliqués dans le CSV");
  }
}

/** Distance haversine en km. */
function haversineKm(a: CityRow, b: CityRow): number {
  const R = 6371;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

type NearbyRow = { citySlug: string; nearbySlug: string; distanceKm: number; position: number };

const nearbyRows: NearbyRow[] = [];
for (const city of cities) {
  const nearest = cities
    .filter((other) => other.slug !== city.slug)
    .map((other) => ({ other, d: haversineKm(city, other) }))
    .sort((a, b) => a.d - b.d || a.other.slug.localeCompare(b.other.slug))
    .slice(0, 5);
  nearest.forEach(({ other, d }, i) => {
    nearbyRows.push({
      citySlug: city.slug,
      nearbySlug: other.slug,
      distanceKm: Math.round(d * 10) / 10,
      position: i + 1,
    });
  });
}

/* ------------------------------------------------------------------ */
/* Émission SQL                                                        */
/* ------------------------------------------------------------------ */

const sql: string[] = [];
const counts = new Map<string, number>();
const bump = (table: string, n = 1) => counts.set(table, (counts.get(table) ?? 0) + n);

const banner = (title: string) => {
  sql.push("");
  sql.push(`-- ${"-".repeat(74)}`);
  sql.push(`-- ${title}`);
  sql.push(`-- ${"-".repeat(74)}`);
  sql.push("");
};

sql.push("-- ============================================================================");
sql.push("-- supabase/seed.sql — FICHIER GÉNÉRÉ, NE PAS ÉDITER À LA MAIN.");
sql.push("--");
sql.push("-- Source de vérité : src/data/content/* (+ src/data/blogPosts.ts,");
sql.push("-- scripts/data/cities-fr.csv, public/images/**).");
sql.push("-- Régénérer : npx tsx scripts/generate-seed.ts");
sql.push("--");
sql.push("-- Ce seed cible une base FRAÎCHE (supabase db reset) : INSERTs simples,");
sql.push("-- UUID déterministes (uuidv5, namespace fixe), transaction unique.");
sql.push("-- ============================================================================");
sql.push("");
sql.push("begin;");

/* ---- media (avant pages/posts/testimonials : FK cover/avatar) ---- */

banner("media — images existantes servies depuis /public/images (bucket 'legacy')");
sql.push(
  "insert into public.media (id, bucket, path, url, alt, title, mime, size_bytes, folder) values",
);
sql.push(
  imagePaths
    .map((publicPath) => {
      const ext = path.extname(publicPath).toLowerCase();
      const mime = MIME_BY_EXT[ext];
      if (!mime) throw new Error(`Extension inconnue : ${publicPath}`);
      const rel = publicPath.slice("/images/".length);
      const folder = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : null;
      const cols = [
        sqlString(mediaIdByPath.get(publicPath) as string),
        sqlString("legacy"),
        sqlString(publicPath),
        sqlString(publicPath),
        sqlString(altByPath.get(publicPath) ?? ""),
        "null",
        sqlString(mime),
        "0",
        sqlText(folder),
      ];
      bump("media");
      return `  (${cols.join(", ")})`;
    })
    .join(",\n") + ";",
);

/* ---- pages + page_sections ---- */

banner("pages + page_sections — 11 pages gérées (payloads validés zod, _v inclus)");
sql.push(
  "insert into public.pages (id, slug, kind, title, status, published_at) values",
);
sql.push(
  parsedPages
    .map((page) => {
      bump("pages");
      const cols = [
        sqlString(uid("pages", page.slug)),
        sqlString(page.slug),
        sqlString("managed"),
        sqlString(page.title),
        sqlString("published"),
        "now()",
      ];
      return `  (${cols.join(", ")})`;
    })
    .join(",\n") + ";",
);

for (const page of parsedPages) {
  sql.push("");
  sql.push(`-- sections de ${page.slug}`);
  sql.push(
    "insert into public.page_sections (id, page_id, section_key, position, type, content) values",
  );
  sql.push(
    page.sections
      .map((slot, index) => {
        bump("page_sections");
        const cols = [
          sqlString(uid("page_sections", `${page.slug}:${slot.key}`)),
          sqlString(uid("pages", page.slug)),
          sqlString(slot.key),
          String(index),
          sqlString(slot.type),
          sqlJson(slot.content),
        ];
        return `  (${cols.join(", ")})`;
      })
      .join(",\n") + ";",
  );
}

/* ---- posts ---- */

banner("posts — articles du blog (body = Tiptap, body_legacy = BlogSection[])");
sql.push(
  "insert into public.posts (id, slug, title, excerpt, cover_media_id, cover_alt, status, published_at, reading_time_min, body, body_legacy, origin) values",
);
sql.push(
  BLOG_POSTS.map((post) => {
    if (post.sections.length === 0) {
      throw new Error(`Article sans section : ${post.slug}`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(post.date)) {
      throw new Error(`Date ISO invalide pour ${post.slug} : ${post.date}`);
    }
    const coverId = mediaIdByPath.get(post.image);
    if (!coverId) throw new Error(`Cover introuvable pour ${post.slug} : ${post.image}`);
    bump("posts");
    const cols = [
      sqlString(uid("posts", post.slug)),
      sqlString(post.slug),
      sqlString(post.title),
      sqlString(post.excerpt),
      sqlString(coverId),
      sqlString(post.imageAlt),
      sqlString("published"),
      sqlString(`${post.date} 09:00:00+02`),
      String(parseReadingTime(post.readingTime)),
      sqlJson(blogSectionsToTiptap(post.sections)),
      sqlJson(post.sections),
      sqlString("manual"),
    ];
    return `  (${cols.join(", ")})`;
  }).join(",\n") + ";",
);

/* ---- collections ---- */

banner("collections — testimonials, faq_items, pricing_plans, pricing_examples, feature_items");

sql.push(
  "insert into public.testimonials (id, name, role, avatar_media_id, avatar_path, quote, rating, position, published) values",
);
sql.push(
  TESTIMONIALS.map((t, index) => {
    const avatarId = mediaIdByPath.get(t.avatar.path);
    if (!avatarId) throw new Error(`Avatar introuvable : ${t.avatar.path}`);
    bump("testimonials");
    const cols = [
      sqlString(uid("testimonials", t.name)),
      sqlString(t.name),
      sqlString(t.role),
      sqlString(avatarId),
      sqlString(t.avatar.path),
      sqlString(t.quote),
      "5",
      String(index),
      "true",
    ];
    return `  (${cols.join(", ")})`;
  }).join(",\n") + ";",
);

sql.push("");
sql.push(
  "insert into public.faq_items (id, question, answer, context, position, published) values",
);
sql.push(
  FAQ_ITEMS.map((item, index) => {
    bump("faq_items");
    const cols = [
      sqlString(uid("faq_items", item.q)),
      sqlString(item.q),
      sqlString(item.a),
      sqlString("global"),
      String(index),
      "true",
    ];
    return `  (${cols.join(", ")})`;
  }).join(",\n") + ";",
);

sql.push("");
sql.push(
  "insert into public.pricing_plans (id, plan_key, name, sub, price, unit, secondary, featured, badge, cta_label, features, position, published) values",
);
sql.push(
  PRICING_PLANS.map((plan, index) => {
    bump("pricing_plans");
    const cols = [
      sqlString(uid("pricing_plans", plan.planKey)),
      sqlString(plan.planKey),
      sqlString(plan.name),
      sqlString(plan.sub),
      sqlNum(plan.price),
      sqlString(plan.unit),
      sqlString(plan.secondary),
      sqlBool(plan.featured),
      sqlText(plan.badge ?? null),
      sqlString(plan.cta),
      sqlJson(plan.features),
      String(index),
      "true",
    ];
    return `  (${cols.join(", ")})`;
  }).join(",\n") + ";",
);

sql.push("");
sql.push(
  "insert into public.pricing_examples (id, config, monthly, yearly, position) values",
);
sql.push(
  PRICING_EXAMPLES.map((example, index) => {
    bump("pricing_examples");
    const cols = [
      sqlString(uid("pricing_examples", example.config)),
      sqlString(example.config),
      sqlNum(example.monthly),
      sqlNum(example.yearly),
      String(index),
    ];
    return `  (${cols.join(", ")})`;
  }).join(",\n") + ";",
);

sql.push("");
sql.push(
  "insert into public.feature_items (id, collection, icon, kicker, title, text, points, mockup, href, href_label, position, published) values",
);
sql.push(
  FEATURE_ITEMS.map((item) => {
    bump("feature_items");
    const cols = [
      sqlString(uid("feature_items", `${item.collection}:${item.position}`)),
      sqlString(item.collection),
      sqlString(item.icon),
      sqlString(item.kicker),
      sqlString(item.title),
      sqlString(item.text),
      sqlJson(item.points),
      sqlString(item.mockup),
      sqlText(item.href ?? null),
      sqlText(item.hrefLabel ?? null),
      String(item.position),
      "true",
    ];
    return `  (${cols.join(", ")})`;
  }).join(",\n") + ";",
);

/* ---- menus + site_settings ---- */

banner("menus + site_settings");

sql.push("insert into public.menus (key, items) values");
sql.push(
  Object.entries(MENUS)
    .map(([key, items]) => {
      bump("menus");
      return `  (${sqlString(key)}, ${sqlJson(items)})`;
    })
    .join(",\n") + ";",
);

const LEGAL_ENTITY_SKELETON = {
  raison_sociale: "",
  siret: "",
  tva: "",
  directeur: "",
  adresse: "",
  date_maj_cgu: "",
  date_maj_confidentialite: "",
  date_maj_mentions: "",
};

const settingsRows: [key: string, value: unknown][] = [
  ...Object.entries(SETTINGS),
  ["jsonld_org", JSONLD_ORG],
  ["jsonld_software", JSONLD_SOFTWARE],
  ["legal_entity", LEGAL_ENTITY_SKELETON],
];

sql.push("");
sql.push("insert into public.site_settings (key, value, is_public) values");
sql.push(
  settingsRows
    .map(([key, value]) => {
      bump("site_settings");
      return `  (${sqlString(key)}, ${sqlJson(value)}, true)`;
    })
    .join(",\n") + ";",
);

/* ---- seo_meta ---- */

banner("seo_meta — défauts par route + articles du blog");
sql.push(
  "insert into public.seo_meta (id, path, title, title_absolute, description, canonical, sitemap_include, sitemap_priority, sitemap_changefreq) values",
);
const seoRows: string[] = [];
for (const [route, seo] of Object.entries(SEO_DEFAULTS)) {
  bump("seo_meta");
  const cols = [
    sqlString(uid("seo_meta", route)),
    sqlString(route),
    sqlString(seo.title),
    sqlBool("titleAbsolute" in seo ? seo.titleAbsolute : false),
    sqlString(seo.description),
    sqlString(seo.canonical),
    "true",
    seo.sitemapPriority.toFixed(1),
    sqlString(seo.sitemapChangefreq),
  ];
  seoRows.push(`  (${cols.join(", ")})`);
}
for (const post of BLOG_POSTS) {
  bump("seo_meta");
  const route = `/blog/${post.slug}`;
  const cols = [
    sqlString(uid("seo_meta", route)),
    sqlString(route),
    sqlString(post.title),
    "false",
    sqlString(post.excerpt),
    sqlString(route),
    "true",
    "0.5",
    sqlString("yearly"),
  ];
  seoRows.push(`  (${cols.join(", ")})`);
}
sql.push(seoRows.join(",\n") + ";");

/* ---- cities + city_nearby ---- */

banner("cities — seed INSEE (status 'seeded', publication par vagues) + city_nearby");
sql.push(
  "insert into public.cities (id, slug, name, name_locative, dept_code, dept_name, region, population, lat, lng, wave, status) values",
);
sql.push(
  cities
    .map((city) => {
      bump("cities");
      const cols = [
        sqlString(uid("cities", city.slug)),
        sqlString(city.slug),
        sqlString(city.name),
        sqlString(city.nameLocative),
        sqlString(city.deptCode),
        sqlString(city.deptName),
        sqlString(city.region),
        String(city.population),
        String(city.lat),
        String(city.lng),
        String(city.wave),
        sqlString("seeded"),
      ];
      return `  (${cols.join(", ")})`;
    })
    .join(",\n") + ";",
);

sql.push("");
sql.push(
  "insert into public.city_nearby (city_id, nearby_city_id, distance_km, position) values",
);
sql.push(
  nearbyRows
    .map((row) => {
      bump("city_nearby");
      const cols = [
        sqlString(uid("cities", row.citySlug)),
        sqlString(uid("cities", row.nearbySlug)),
        row.distanceKm.toFixed(1),
        String(row.position),
      ];
      return `  (${cols.join(", ")})`;
    })
    .join(",\n") + ";",
);

sql.push("");
sql.push("commit;");
sql.push("");

/* ------------------------------------------------------------------ */
/* Vérifications finales + écriture                                    */
/* ------------------------------------------------------------------ */

if (counts.get("cities") !== cities.length) {
  throw new Error(
    `Villes : ${counts.get("cities")} rows émises pour ${cities.length} lignes CSV`,
  );
}
if (counts.get("city_nearby") !== cities.length * 5) {
  throw new Error("city_nearby : chaque ville doit avoir exactement 5 voisines");
}
if (counts.get("pages") !== 11) {
  throw new Error(`pages : ${counts.get("pages")} rows (attendu 11)`);
}
if (counts.get("feature_items") !== 13) {
  throw new Error(
    `feature_items : ${counts.get("feature_items")} rows (attendu 13 = 10 features + 3 bilans)`,
  );
}

fs.writeFileSync(OUT_PATH, sql.join("\n"), "utf8");

console.log(`✓ ${path.relative(ROOT, OUT_PATH)} généré (${sql.join("\n").length} octets)\n`);
console.log("Rows par table :");
for (const [table, count] of [...counts.entries()].sort((a, b) =>
  a[0].localeCompare(b[0]),
)) {
  console.log(`  ${table.padEnd(18)} ${count}`);
}
console.log(
  `\nTotal : ${[...counts.values()].reduce((a, b) => a + b, 0)} rows, ` +
    `${parsedPages.reduce((n, p) => n + p.sections.length, 0)} payloads de sections validés zod.`,
);
