import type { CityLocalData } from "@/lib/cms/city-data";

/* ============================================================
   Contrôle qualité SEO d'une page ville, avant publication.
   Fonctions pures (testées), appelées par le générateur : une
   page qui échoue est régénérée avec la liste des problèmes,
   puis bloquée en `needs_review` si elle échoue encore.

   Règles :
   · chiffres : uniquement ceux des données locales fournies et
     les quelques faits produit listés ici (aucun fait inventé) ;
   · intention : « logiciel » + « podologue » + ville dans le titre et le
     H1 (la page vise le praticien qui cherche un logiciel, pas le patient
     qui cherche un podologue) ; titre ≤ 60 car., description 110-155 car. ;
   · anti-cannibalisation : titre, H1 et description jamais repris d'une
     autre ville ; FAQ centrée sur la ville (au moins 3 questions la citent),
     aucune question de prix (le prix vit sur /tarifs) ;
   · unicité : texte pas trop proche d'une autre ville (anti « contenu
     produit en masse ») ;
   · style : pas de tiret cadratin ni de tournures creuses.
   ============================================================ */

export type CityPageDraft = {
  seo_title: string;
  seo_description: string;
  h1: string;
  content: { intro: string; contexte_local: string; benefices: string; meta_description: string };
  faq: { q: string; a: string }[];
};

export type QualityIssue = { code: string; detail: string };

/** Faits produit chiffrés autorisés dans toutes les pages. */
export const PRODUCT_NUMBERS = [
  "13", // bilans podologiques normés
  "24,84", // €/mois, prix d'appel
  "7", // support 7j/7
  "10000", // densité exprimée « pour 10 000 habitants »
  "100", // « 100 % en ligne »
];

export const LIMITS = {
  titleMax: 60,
  descriptionMin: 110,
  descriptionMax: 155,
  h1Max: 80,
  introMin: 160,
  contexteMin: 450,
  beneficesMin: 350,
  faqMin: 4,
  faqMax: 6,
  /** Questions (intitulé seul) qui citent la ville. */
  faqLocalMin: 3,
  /** Au-delà, deux pages sont jugées trop proches (Jaccard sur 4-grammes). */
  similarityMax: 0.18,
};

/** Tournures creuses ou « trop IA » refusées (comparaison sans accents). */
const BANNED = [
  "n'hesitez pas",
  "dans un monde",
  "en constante evolution",
  "incontournable",
  "veritable allie",
  "a l'ere du numerique",
  "revolution",
  "sans plus attendre",
  "que vous soyez",
  "il est essentiel de",
  "boostez",
  "cle en main",
];

/** Question de prix : réservée à la page Tarifs (sinon cannibalisation). */
const PRICE_QUESTION = /\b(prix|tarifs?|couts?|coute|budget|abonnement)\b/;

/* ------------------------------------------------------------------ */

/** Minuscules sans accents, apostrophes normalisées. */
export function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’`]/g, "'")
    .toLowerCase();
}

/** Nombres présents dans un texte, sous forme canonique (« 39 432 » → « 39432 », « 4,3 » → « 4,3 »). */
export function extractNumbers(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\d(?:[\d\u00a0\u202f ]*\d)?(?:[.,]\d+)?/g)) {
    out.push(canonical(m[0]));
  }
  return out;
}

function canonical(raw: string): string {
  const compact = raw.replace(/[\s\u00a0\u202f]/g, "").replace(".", ",");
  /* « 4,0 » → « 4 » ; « 24,84 » reste tel quel. */
  return compact.replace(/,0+$/, "");
}

/** Nombres autorisés pour une ville : ses données + faits produit. */
export function allowedNumbers(data: CityLocalData): Set<string> {
  const values: (number | string | null)[] = [
    data.population,
    data.podologues,
    data.podologuesLiberaux,
    data.densite,
    data.departement.podologues,
    data.departement.population,
    data.departement.densite,
    data.departement.code,
    data.france.podologues,
    data.france.population,
    data.france.densite,
    ...data.codesPostaux,
  ];
  const set = new Set(PRODUCT_NUMBERS);
  for (const v of values) {
    if (v == null) continue;
    set.add(canonical(typeof v === "number" ? String(v).replace(".", ",") : v));
  }
  /* Corse : « 2A » / « 2B » s'écrivent avec un chiffre isolé. */
  const deptDigits = data.departement.code.replace(/\D/g, "");
  if (deptDigits) set.add(deptDigits);
  return set;
}

/** Tous les textes visibles d'une page (pour chiffres, style, similarité). */
function allText(page: CityPageDraft): string[] {
  return [
    page.seo_title,
    page.seo_description,
    page.h1,
    page.content.intro,
    page.content.contexte_local,
    page.content.benefices,
    ...page.faq.flatMap((f) => [f.q, f.a]),
  ];
}

/* ------------------------------------------------------------------ */
/* Similarité entre pages                                             */
/* ------------------------------------------------------------------ */

/** 4-grammes de mots du corps de page, noms propres de la ville retirés
 *  (sinon le simple changement de nom masquerait un gabarit identique). */
export function shingles(page: CityPageDraft, strip: string[] = []): Set<string> {
  let body = fold(
    [page.content.intro, page.content.contexte_local, page.content.benefices, ...page.faq.map((f) => f.a)].join(" "),
  );
  for (const s of strip) {
    if (s) body = body.split(fold(s)).join(" ");
  }
  const words = body.split(/[^a-z0-9']+/).filter(Boolean);
  const set = new Set<string>();
  for (let i = 0; i + 4 <= words.length; i++) set.add(words.slice(i, i + 4).join(" "));
  return set;
}

/** Réponse de FAQ normalisée pour la comparaison entre pages. */
export function answerKey(answer: string): string {
  return fold(answer).replace(/\s+/g, " ").trim();
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const x of small) if (large.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/* ------------------------------------------------------------------ */
/* Contrôle complet                                                   */
/* ------------------------------------------------------------------ */

export type QualityContext = {
  cityName: string;
  deptName: string;
  data: CityLocalData;
  /** Pages déjà générées des autres villes (unicité, similarité). */
  others: {
    slug: string;
    seo_title: string;
    h1: string;
    seo_description: string;
    shingles: Set<string>;
    /** Réponses de FAQ normalisées (aucune ne doit être reprise telle quelle). */
    faqAnswers?: Set<string>;
  }[];
};

export type QualityReport = {
  ok: boolean;
  issues: QualityIssue[];
  /** Plus forte ressemblance avec une autre ville (0 à 1). */
  maxSimilarity: number;
  closestSlug: string | null;
};

export function checkCityPage(page: CityPageDraft, ctx: QualityContext): QualityReport {
  const issues: QualityIssue[] = [];
  const add = (code: string, detail: string) => issues.push({ code, detail });
  const city = fold(ctx.cityName);

  /* Balises */
  if (page.seo_title.length > LIMITS.titleMax) add("title_length", `${page.seo_title.length} caractères (max ${LIMITS.titleMax})`);
  const dl = page.seo_description.length;
  if (dl < LIMITS.descriptionMin || dl > LIMITS.descriptionMax) {
    add("description_length", `${dl} caractères (attendu ${LIMITS.descriptionMin} à ${LIMITS.descriptionMax})`);
  }
  if (page.h1.length > LIMITS.h1Max) add("h1_length", `${page.h1.length} caractères (max ${LIMITS.h1Max})`);
  if (!fold(page.seo_title).includes(city)) add("title_city", "le nom de la ville manque dans le titre");
  if (!fold(page.h1).includes(city)) add("h1_city", "le nom de la ville manque dans le H1");
  if (!fold(page.seo_description).includes(city)) add("description_city", "le nom de la ville manque dans la description");
  if (!/logiciel/i.test(page.seo_title) || !/podologue/i.test(page.seo_title)) {
    add("title_keyword", "« logiciel » et « podologue » doivent figurer dans le titre");
  }
  if (!/logiciel/i.test(page.h1) || !/podolog/i.test(page.h1)) {
    add("h1_keyword", "« logiciel » et « podologue » doivent figurer dans le H1 (intention praticien)");
  }
  if (fold(page.seo_title) === fold(page.h1)) add("title_equals_h1", "le H1 recopie le titre");

  /* Longueurs du corps */
  if (page.content.intro.length < LIMITS.introMin) add("intro_short", `${page.content.intro.length} caractères (min ${LIMITS.introMin})`);
  if (page.content.contexte_local.length < LIMITS.contexteMin) {
    add("contexte_short", `${page.content.contexte_local.length} caractères (min ${LIMITS.contexteMin})`);
  }
  if (page.content.benefices.length < LIMITS.beneficesMin) {
    add("benefices_short", `${page.content.benefices.length} caractères (min ${LIMITS.beneficesMin})`);
  }
  if (!fold(page.content.intro).includes(city)) add("intro_city", "le nom de la ville manque dans l'introduction");

  /* FAQ localisée */
  if (page.faq.length < LIMITS.faqMin || page.faq.length > LIMITS.faqMax) {
    add("faq_count", `${page.faq.length} questions (attendu ${LIMITS.faqMin} à ${LIMITS.faqMax})`);
  }
  const local = page.faq.filter((f) => fold(f.q).includes(city)).length;
  if (local < LIMITS.faqLocalMin) add("faq_local", `${local} question(s) citant la ville (min ${LIMITS.faqLocalMin})`);
  const price = page.faq.filter((f) => PRICE_QUESTION.test(fold(f.q)));
  if (price.length > 0) add("faq_price", `question de prix (réservée à la page Tarifs) : ${price.map((f) => f.q).join(" / ")}`);

  /* Chiffres : uniquement les données fournies */
  const allowed = allowedNumbers(ctx.data);
  const unknown = new Set<string>();
  for (const text of allText(page)) {
    for (const n of extractNumbers(text)) if (!allowed.has(n)) unknown.add(n);
  }
  if (unknown.size > 0) add("unknown_number", `chiffres absents des données : ${[...unknown].join(", ")}`);

  /* Style */
  const joined = allText(page).join("\n");
  if (/[—–]/.test(joined) || /\s--\s/.test(joined)) add("dash", "tiret cadratin ou demi-cadratin utilisé");
  const folded = fold(joined);
  const banned = BANNED.filter((b) => folded.includes(b));
  if (banned.length > 0) add("banned_phrase", `tournures refusées : ${banned.join(", ")}`);

  /* Unicité et similarité */
  const mine = shingles(page, [ctx.cityName, ctx.deptName]);
  const myAnswers = page.faq.map((f) => answerKey(f.a));
  let maxSimilarity = 0;
  let closestSlug: string | null = null;
  for (const other of ctx.others) {
    if (fold(other.seo_title) === fold(page.seo_title)) add("duplicate_title", `titre identique à ${other.slug}`);
    if (fold(other.h1) === fold(page.h1)) add("duplicate_h1", `H1 identique à ${other.slug}`);
    if (fold(other.seo_description) === fold(page.seo_description)) {
      add("duplicate_description", `description identique à ${other.slug}`);
    }
    const same = other.faqAnswers ? myAnswers.filter((a) => other.faqAnswers!.has(a)).length : 0;
    if (same > 0) add("duplicate_faq_answer", `${same} réponse(s) de FAQ identique(s) à ${other.slug}`);
    const sim = jaccard(mine, other.shingles);
    if (sim > maxSimilarity) {
      maxSimilarity = sim;
      closestSlug = other.slug;
    }
  }
  if (maxSimilarity > LIMITS.similarityMax) {
    add("too_similar", `texte trop proche de ${closestSlug} (${Math.round(maxSimilarity * 100)} %)`);
  }

  return { ok: issues.length === 0, issues, maxSimilarity, closestSlug };
}
