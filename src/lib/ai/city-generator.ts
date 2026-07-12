import "server-only";
import { generateStructured } from "./anthropic";
import { serviceClient } from "@/lib/supabase/service";

/* ============================================================
   Génération du contenu d'une page ville (kind='city_page').
   Anti-thin-content : angle localisé, FAQ localisées, tout fait
   local incertain versé dans claims_to_verify (vérif humaine).
   L'IA NE PUBLIE JAMAIS : la ville passe en 'generated', la revue
   humaine décide de la suite (gate obligatoire, cf. 0009_ai.sql).
   ============================================================ */

export const CITY_PROMPT_VERSION = "city-v1";

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
        meta_description: { type: "string" },
        claims_to_verify: { type: "array", items: { type: "string" } },
      },
      required: ["intro", "contexte_local", "benefices", "meta_description", "claims_to_verify"],
    },
    faq: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          q: { type: "string" },
          a: { type: "string" },
        },
        required: ["q", "a"],
      },
    },
  },
  required: ["seo_title", "seo_description", "h1", "content", "faq"],
} as const;

export type CityContent = {
  seo_title: string;
  seo_description: string;
  h1: string;
  content: {
    intro: string;
    contexte_local: string;
    benefices: string;
    meta_description: string;
    claims_to_verify: string[];
  };
  faq: { q: string; a: string }[];
};

const SYSTEM = `Tu rédiges des pages SEO locales pour MediCare Pro, un logiciel de gestion de cabinet destiné aux pédicures-podologues en France (dossiers patients, 13 bilans podologiques, facturation, agenda, comptabilité, signature électronique ; hébergement HDS en France ; à partir de 24,84 €/mois).

Objectif : une page par ville qui aide un podologue de cette ville à comprendre pourquoi MediCare Pro convient à son cabinet, sans contenu générique interchangeable.

RÈGLES STRICTES :
- Français professionnel, chaleureux, jamais racoleur. Vouvoiement.
- Ancre le propos dans le métier (semelles, orthèses plantaires, bilans du pied diabétique, posturologie).
- Varie l'angle d'une ville à l'autre : ne recopie pas une trame figée.
- N'INVENTE AUCUN FAIT LOCAL. Si tu es tenté d'affirmer un chiffre local (nombre de podologues, densité, hôpital, statistique), ne l'écris PAS dans le texte : mets-le à la place dans claims_to_verify sous forme « affirmation à vérifier ».
- seo_title ≤ 60 caractères, inclut le nom de la ville. seo_description et meta_description ≤ 155 caractères.
- h1 naturel incluant la ville.
- content.intro : 2-3 phrases d'accroche localisées.
- content.contexte_local : un paragraphe reliant la pratique podologique locale au logiciel, SANS fait inventé.
- content.benefices : un paragraphe sur les gains concrets (temps, conformité, tout-en-un).
- faq : 4 à 6 questions/réponses, dont au moins 2 explicitement liées à la ville.`;

/** Appelle l'IA pour générer le contenu d'une ville. */
export async function generateCityContent(city: {
  name: string;
  name_locative: string;
  dept_name: string;
  region: string;
}): Promise<Awaited<ReturnType<typeof generateStructured<CityContent>>>> {
  const user = `Ville : ${city.name} (${city.name_locative}), département ${city.dept_name}, région ${city.region}.

Rédige la page SEO locale pour un pédicure-podologue exerçant ${city.name_locative}. Respecte toutes les règles, notamment : aucun fait local inventé (verse tout fait incertain dans claims_to_verify), au moins 2 questions de FAQ mentionnant ${city.name}.`;

  return generateStructured<CityContent>({
    system: SYSTEM,
    user,
    schema: CITY_SCHEMA,
    effort: "medium",
    maxTokens: 4000,
  });
}

/** Validation applicative post-génération (structured outputs ne gère pas
 *  minLength/maxItems) : renvoie la liste des problèmes bloquants. */
export function validateCityContent(data: CityContent): string[] {
  const issues: string[] = [];
  if (data.seo_title.length > 65) issues.push("seo_title trop long");
  if (data.seo_description.length > 165) issues.push("seo_description trop longue");
  if (!Array.isArray(data.faq) || data.faq.length < 4) {
    issues.push("moins de 4 questions de FAQ");
  }
  if (!data.content?.intro?.trim()) issues.push("intro vide");
  return issues;
}

/* ------------------------------------------------------------------ */
/* Worker : traite une génération réclamée                            */
/* ------------------------------------------------------------------ */

type Service = NonNullable<ReturnType<typeof serviceClient>>;

/** Traite UNE génération city_page réclamée (déjà passée en 'running'
 *  par claim_ai_generation). Écrit le résultat sur la ville + la row
 *  ai_generations. Best-effort : les erreurs marquent la génération 'failed'. */
export async function processCityGeneration(
  service: Service,
  generation: { id: string; subject_id: string | null },
): Promise<{ ok: boolean; message: string }> {
  const cityId = generation.subject_id;
  if (!cityId) {
    await failGeneration(service, generation.id, "subject_id (city_id) manquant");
    return { ok: false, message: "city_id manquant" };
  }

  const { data: city } = await service
    .from("cities")
    .select("id, name, name_locative, dept_name, region, status")
    .eq("id", cityId)
    .maybeSingle();
  if (!city) {
    await failGeneration(service, generation.id, "ville introuvable");
    return { ok: false, message: "ville introuvable" };
  }

  try {
    const result = await generateCityContent(city);
    const issues = validateCityContent(result.data);
    if (issues.length > 0) {
      throw new Error(`Contenu invalide : ${issues.join(", ")}`);
    }

    const { data } = result;
    /* Écrit la ville en 'generated' (jamais publiée directement). */
    await service
      .from("cities")
      .update({
        seo_title: data.seo_title,
        seo_description: data.seo_description,
        h1: data.h1,
        content: data.content,
        faq: data.faq,
        generation_id: generation.id,
        status: "generated",
      })
      .eq("id", cityId);

    await service
      .from("ai_generations")
      .update({
        status: "succeeded",
        output: data as unknown as Record<string, unknown>,
        model: result.model,
        prompt_version: CITY_PROMPT_VERSION,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        cost_usd: result.costUsd,
      })
      .eq("id", generation.id);

    return { ok: true, message: `${city.name} générée` };
  } catch (err) {
    const message = err instanceof Error ? err.message : "erreur inconnue";
    await failGeneration(service, generation.id, message);
    return { ok: false, message };
  }
}

async function failGeneration(service: Service, id: string, error: string) {
  await service
    .from("ai_generations")
    .update({ status: "failed", error: error.slice(0, 500) })
    .eq("id", id);
}
