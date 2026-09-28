import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateStructured } from "./anthropic";
import {
  answerKey,
  checkCityPage,
  shingles,
  type CityPageDraft,
  type QualityContext,
  type QualityReport,
} from "./city-quality";
import { cityLabel, cityTitle, formatDecimal, formatInt, isLocalData, type CityLocalData } from "@/lib/cms/city-data";

/* ============================================================
   Génération du contenu d'une page ville (kind='city_page'), v2.
   L'IA reçoit les données locales réelles (Annuaire Santé, INSEE)
   et ne peut citer que ces chiffres et les faits produit listés.
   Chaque page passe le contrôle qualité SEO (city-quality.ts) ;
   en cas d'échec elle est régénérée avec la liste des problèmes,
   puis bloquée en 'needs_review'. Une page conforme passe en
   'approved' : la publication reste un geste explicite, par vague.
   ============================================================ */

export const CITY_PROMPT_VERSION = "city-v2";
const MAX_ATTEMPTS = 3;

/** Schéma JSON strict de la sortie (structured outputs). */
const CITY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    seo_title: { type: "string" },
    seo_description: { type: "string" },
    h1: { type: "string" },
    content: {
      type: "object",
      additionalProperties: false,
      properties: {
        intro: { type: "string" },
        contexte_local: { type: "string" },
        benefices: { type: "string" },
        claims_to_verify: { type: "array", items: { type: "string" } },
      },
      required: ["intro", "contexte_local", "benefices", "claims_to_verify"],
    },
    faq: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { q: { type: "string" }, a: { type: "string" } },
        required: ["q", "a"],
      },
    },
  },
  required: ["seo_title", "seo_description", "h1", "content", "faq"],
} as const;

type AiCityOutput = {
  seo_title: string;
  seo_description: string;
  h1: string;
  content: { intro: string; contexte_local: string; benefices: string; claims_to_verify: string[] };
  faq: { q: string; a: string }[];
};

export type GeneratedCityPage = CityPageDraft & {
  content: CityPageDraft["content"] & { claims_to_verify: string[] };
};

/** Consignes de rédaction (IA ou rédaction en session, cf. scripts/cities-brief.ts). */
export const CITY_SYSTEM_PROMPT = `Tu rédiges les pages locales de MediCare Pro, logiciel de gestion de cabinet pour les pédicures-podologues en France. Chaque page s'adresse à un pédicure-podologue qui exerce dans la ville indiquée et lui montre, avec des faits, pourquoi le logiciel convient à son cabinet.

Faits produit (les seuls que tu peux affirmer sur le logiciel) :
- 13 bilans podologiques normés (pied diabétique, chutes, posturologie, sport, pédiatrie…) : le logiciel applique la grille, calcule le score et le compare au bilan précédent ; le grade de risque du pied diabétique se calcule pendant l'examen.
- Facturation : chaque acte génère sa facture numérotée, envoyée au patient ; carte Vitale et ApCV intégrées.
- Agenda : réservation en ligne par les patients, rappels par SMS et e-mail.
- Orthèses plantaires : éléments, matériaux et lot de chaque paire rattachés au dossier, prêts pour la matériovigilance.
- Compte-rendu : les observations sont mises en forme par l'IA dans un compte-rendu clinique que le praticien relit et valide.
- Comptabilité tenue au fil de l'eau, export FEC pour l'AGA.
- Signature électronique eIDAS pour les consentements.
- Application installable sur mobile et tablette pour les soins à domicile, avec scan des ordonnances.
- Portail patient.
- Hébergement certifié HDS en France chez OVHcloud, conforme RGPD ; logiciel 100 % en ligne.
- Mise en route à distance avec reprise des données ; support 7j/7 par chat.
- Prix : à partir de 24,84 € par mois.

Règles :
- Français professionnel et chaleureux, vouvoiement, phrases simples. Vocabulaire du métier (semelles, orthèses plantaires, pied diabétique, bilans, soins à domicile).
- Chiffres : uniquement ceux des données fournies, écrits exactement comme fournis, et ceux des faits produit. Aucune date, aucune distance, aucun pourcentage, aucune estimation. Ne cite aucun établissement, hôpital, rue ou quartier. Si tu voudrais affirmer un fait local absent des données, ne l'écris pas : mets-le dans claims_to_verify.
- Les chiffres de podologues viennent de l'Annuaire Santé, la population de l'INSEE : tu peux le dire, sans date.
- Pas de tiret cadratin ni demi-cadratin : utilise des virgules, des parenthèses ou deux phrases. Pas de formules creuses (« n'hésitez pas », « incontournable », « véritable allié », « révolutionner », « dans un monde »…).
- Écris une page propre à cette ville : pars de ses chiffres et de l'angle indiqué, ne suis pas un gabarit.

Champs :
- seo_title : reprends exactement le « titre imposé » de la fiche (une seule cible par page : logiciel podologue + ville).
- seo_description : entre 110 et 155 caractères, contient le nom de la ville, donne envie de cliquer.
- h1 : différent du titre, contient le nom de la ville, « logiciel » et « podologue » (ou « pédicure-podologue ») : la page s'adresse à un praticien qui cherche un logiciel, pas à un patient qui cherche un podologue.
- content.intro : 2 ou 3 phrases (au moins 160 caractères), cite le nom de la ville.
- content.contexte_local : un paragraphe d'au moins 450 caractères qui relie les chiffres locaux (nombre de podologues, densité comparée au département et à la France, taille de la ville) à l'organisation d'un cabinet.
- content.benefices : un paragraphe d'au moins 350 caractères sur les gains concrets, centré sur la fonctionnalité mise en avant.
- faq : 4 à 6 questions-réponses, réponse directe dès la première phrase. Au moins 3 questions citent explicitement la ville dans leur intitulé, dont une sur le nombre de pédicures-podologues qui y exercent (réponse avec les chiffres fournis). Aucune question sur le prix ou l'abonnement : le prix est présenté sur la page Tarifs, pas sur les pages villes.`;

/* ------------------------------------------------------------------ */
/* Angle éditorial : varie d'une ville à l'autre selon ses données    */
/* ------------------------------------------------------------------ */

const FOCUS = [
  "les bilans du pied diabétique et le suivi des patients à risque",
  "les orthèses plantaires et leur traçabilité",
  "la posturologie et les bilans posturaux",
  "la facturation avec carte Vitale et ApCV",
  "l'agenda en ligne et les rappels par SMS et e-mail",
  "les soins à domicile depuis le mobile ou la tablette",
  "la comptabilité au fil de l'eau et l'export FEC",
  "le compte-rendu clinique mis en forme par l'IA",
];

function hash(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export function cityAngle(name: string, data: CityLocalData): { angle: string; focus: string } {
  const size =
    data.population >= 200_000
      ? "une grande ville, où les cabinets sont nombreux et la patientèle variée"
      : data.population >= 30_000
        ? "une ville moyenne, pôle de soins pour les communes alentour"
        : data.population >= 10_000
          ? "une petite ville, où le cabinet de proximité suit ses patients dans la durée"
          : "une commune où le podologue exerce souvent aussi à domicile";
  const d = data.densite;
  const vsDept =
    d == null || data.podologues === 0
      ? "aucun pédicure-podologue n'y est recensé : c'est un territoire à couvrir"
      : d > data.departement.densite * 1.15
        ? "la densité de podologues y est plus forte que dans le département : il faut se distinguer par la qualité du suivi"
        : d < data.departement.densite * 0.85
          ? "la densité de podologues y est plus faible que dans le département : les agendas sont chargés, chaque minute compte"
          : "la densité de podologues y est proche de celle du département";
  return { angle: `${name} est ${size} ; ${vsDept}.`, focus: FOCUS[hash(data.insee) % FOCUS.length] };
}

/* ------------------------------------------------------------------ */

export type CityForGeneration = {
  id: string;
  slug: string;
  name: string;
  name_locative: string;
  dept_code: string;
  dept_name: string;
  region: string;
  local_data: CityLocalData;
  /** Noms des villes voisines (sans distance). */
  nearby: string[];
};

/** Fiche de la ville : identité, chiffres à citer, angle et fonctionnalité. */
export function buildCityPrompt(city: CityForGeneration, feedback: string[] = []): string {
  const d = city.local_data;
  const { angle, focus } = cityAngle(city.name, d);
  const homonym = Boolean(d.homonyme);

  const identity = [
    homonym
      ? `Ville : ${cityLabel(city.name, city.dept_code, true)}, à distinguer de ses homonymes : écris « ${cityLabel(city.name, city.dept_code, true)} » dans le H1`
      : `Ville : ${city.name}`,
    `Titre imposé : ${cityTitle(city.name_locative, city.dept_code, homonym)}`,
    `Forme locative : ${city.name_locative}`,
    `Département : ${d.departement.nom} (${d.departement.code}), région ${city.region}`,
  ];

  const data = ["Données (à citer exactement ainsi) :", `- population : ${formatInt(d.population)} habitants`];
  data.push(`- pédicures-podologues exerçant ${city.name_locative} : ${formatInt(d.podologues)}, dont ${formatInt(d.podologuesLiberaux)} en libéral`);
  if (d.densite != null) data.push(`- densité ${city.name_locative} : ${formatDecimal(d.densite)} podologues pour 10 000 habitants`);
  data.push(`- département : ${formatInt(d.departement.podologues)} podologues, ${formatDecimal(d.departement.densite)} pour 10 000 habitants`);
  data.push(`- France : ${formatInt(d.france.podologues)} podologues, ${formatDecimal(d.france.densite)} pour 10 000 habitants`);
  if (city.nearby.length) data.push(`- villes voisines (sans distance) : ${city.nearby.join(", ")}`);

  const brief = [`Angle : ${angle}`, `Fonctionnalité à mettre en avant : ${focus}.`];

  const blocks = [identity, data, brief];
  if (feedback.length) {
    blocks.push(["Ta version précédente a été refusée par le contrôle qualité. Corrige ces points :", ...feedback.map((f) => `- ${f}`)]);
  }
  return blocks.map((b) => b.join("\n")).join("\n\n");
}

/* ------------------------------------------------------------------ */

export type OtherPage = QualityContext["others"][number];

/** Page déjà générée → entrée de comparaison (unicité, similarité). */
export function toOtherPage(row: {
  slug: string;
  name: string;
  dept_name: string;
  seo_title: string | null;
  h1: string | null;
  seo_description: string | null;
  content: unknown;
  faq: unknown;
}): OtherPage | null {
  const content = row.content as CityPageDraft["content"] | null;
  if (!content?.intro || !row.seo_title || !row.h1 || !row.seo_description) return null;
  const draft: CityPageDraft = {
    seo_title: row.seo_title,
    seo_description: row.seo_description,
    h1: row.h1,
    content,
    faq: Array.isArray(row.faq) ? (row.faq as CityPageDraft["faq"]) : [],
  };
  return {
    slug: row.slug,
    seo_title: row.seo_title,
    h1: row.h1,
    seo_description: row.seo_description,
    shingles: shingles(draft, [row.name, row.dept_name]),
    faqAnswers: new Set(draft.faq.map((f) => answerKey(f.a))),
  };
}

export type CheckedCity = {
  page: GeneratedCityPage;
  report: QualityReport;
  attempts: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  angle: { angle: string; focus: string };
};

/** Génère la page d'une ville et la soumet au contrôle qualité, avec
 *  jusqu'à MAX_ATTEMPTS essais (chaque échec renvoie ses problèmes à l'IA). */
export async function generateCheckedCity(city: CityForGeneration, others: OtherPage[]): Promise<CheckedCity> {
  const ctx: QualityContext = {
    cityName: city.name,
    deptName: city.dept_name,
    data: city.local_data,
    others: others.filter((o) => o.slug !== city.slug),
  };
  let feedback: string[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let cost: number | null = 0;
  let last: CheckedCity | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await generateStructured<AiCityOutput>({
      system: CITY_SYSTEM_PROMPT,
      user: buildCityPrompt(city, feedback),
      schema: CITY_SCHEMA,
      effort: "medium",
    });
    inputTokens += result.inputTokens;
    outputTokens += result.outputTokens;
    cost = cost == null || result.costUsd == null ? null : cost + result.costUsd;

    const out = result.data;
    const page: GeneratedCityPage = {
      /* Titre imposé : une cible unique par page, jamais laissée à l'IA. */
      seo_title: cityTitle(city.name_locative, city.dept_code, city.local_data.homonyme),
      seo_description: out.seo_description.trim(),
      h1: out.h1.trim(),
      content: {
        intro: out.content.intro.trim(),
        contexte_local: out.content.contexte_local.trim(),
        benefices: out.content.benefices.trim(),
        meta_description: out.seo_description.trim(),
        claims_to_verify: out.content.claims_to_verify,
      },
      faq: out.faq.map((f) => ({ q: f.q.trim(), a: f.a.trim() })),
    };
    const report = checkCityPage(page, ctx);
    last = {
      page,
      report,
      attempts: attempt,
      model: result.model,
      inputTokens,
      outputTokens,
      costUsd: cost,
      angle: cityAngle(city.name, city.local_data),
    };
    if (report.ok) break;
    feedback = report.issues.map((i) => `${i.code} : ${i.detail}`);
  }
  return last!;
}

/* ------------------------------------------------------------------ */
/* Lecture / écriture en base                                          */
/* ------------------------------------------------------------------ */

type Service = SupabaseClient;

const CITY_COLUMNS = "id, slug, name, name_locative, dept_code, dept_name, region, local_data";

/** Charge une ville et ses voisines, prête pour la génération. */
export async function loadCityForGeneration(service: Service, cityId: string): Promise<CityForGeneration | null> {
  const { data: city } = await service.from("cities").select(CITY_COLUMNS).eq("id", cityId).maybeSingle();
  if (!city || !isLocalData(city.local_data)) return null;
  const { data: links } = await service
    .from("city_nearby")
    .select("position, nearby:cities!city_nearby_nearby_city_id_fkey(name)")
    .eq("city_id", cityId)
    .order("position");
  const nearby = (links ?? [])
    .map((l) => (l.nearby as unknown as { name: string } | null)?.name)
    .filter((n): n is string => Boolean(n));
  return { ...(city as Omit<CityForGeneration, "nearby">), nearby };
}

/** Toutes les pages déjà générées (pour l'unicité et la similarité). */
export async function loadOtherPages(service: Service): Promise<OtherPage[]> {
  const out: OtherPage[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await service
      .from("cities")
      .select("slug, name, dept_name, seo_title, h1, seo_description, content, faq")
      .not("content", "is", null)
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const other = toOtherPage(row);
      if (other) out.push(other);
    }
    if (!data || data.length < 1000) return out;
  }
}

/** Enregistre le résultat : ville 'approved' si conforme, sinon 'needs_review'.
 *  Trace la génération dans ai_generations (création, ou mise à jour de la
 *  génération réclamée par le worker). */
export async function saveCheckedCity(
  service: Service,
  city: CityForGeneration,
  result: CheckedCity,
  generationId?: string,
): Promise<void> {
  const generation = {
    kind: "city_page",
    subject_id: city.id,
    status: "succeeded",
    model: result.model,
    prompt_version: CITY_PROMPT_VERSION,
    input: { ...result.angle, attempts: result.attempts },
    output: result.page as unknown as Record<string, unknown>,
    input_tokens: result.inputTokens,
    output_tokens: result.outputTokens,
    cost_usd: result.costUsd,
    attempts: result.attempts,
  };
  let genId = generationId;
  if (genId) {
    await service.from("ai_generations").update(generation).eq("id", genId);
  } else {
    const { data } = await service.from("ai_generations").insert(generation).select("id").single();
    genId = data?.id;
  }

  const { page, report } = result;
  const { error } = await service
    .from("cities")
    .update({
      seo_title: page.seo_title,
      seo_description: page.seo_description,
      h1: page.h1,
      content: page.content,
      faq: page.faq,
      generation_id: genId ?? null,
      status: report.ok ? "approved" : "needs_review",
      quality: {
        ok: report.ok,
        issues: report.issues,
        maxSimilarity: Math.round(report.maxSimilarity * 1000) / 1000,
        closestSlug: report.closestSlug,
        attempts: result.attempts,
        promptVersion: CITY_PROMPT_VERSION,
        checkedAt: new Date().toISOString(),
      },
    })
    .eq("id", city.id);
  if (error) throw new Error(`Enregistrement de ${city.slug} : ${error.message}`);
}

/* ------------------------------------------------------------------ */
/* Worker (route /api/jobs/ai-generate) : une génération réclamée      */
/* ------------------------------------------------------------------ */

/** Traite UNE génération city_page réclamée (déjà 'running'). Best-effort :
 *  les erreurs marquent la génération 'failed'. */
export async function processCityGeneration(
  service: Service,
  generation: { id: string; subject_id: string | null },
  others?: OtherPage[],
): Promise<{ ok: boolean; message: string }> {
  const cityId = generation.subject_id;
  if (!cityId) {
    await failGeneration(service, generation.id, "subject_id (city_id) manquant");
    return { ok: false, message: "city_id manquant" };
  }
  try {
    const city = await loadCityForGeneration(service, cityId);
    if (!city) {
      await failGeneration(service, generation.id, "ville introuvable ou sans données locales");
      return { ok: false, message: "ville introuvable ou sans données locales" };
    }
    const pool = others ?? (await loadOtherPages(service));
    const result = await generateCheckedCity(city, pool);
    await saveCheckedCity(service, city, result, generation.id);
    /* Les villes suivantes du même passage se comparent aussi à celle-ci. */
    const self = toOtherPage({ ...city, ...result.page });
    if (self) pool.push(self);
    return {
      ok: result.report.ok,
      message: result.report.ok
        ? `${city.name} conforme (${result.attempts} essai(s))`
        : `${city.name} à revoir : ${result.report.issues.map((i) => i.code).join(", ")}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "erreur inconnue";
    await failGeneration(service, generation.id, message);
    return { ok: false, message };
  }
}

async function failGeneration(service: Service, id: string, error: string) {
  await service.from("ai_generations").update({ status: "failed", error: error.slice(0, 500) }).eq("id", id);
}
