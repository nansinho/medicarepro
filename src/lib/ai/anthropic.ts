import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

/* ============================================================
   Client Anthropic (génération de contenu IA — pages villes).
   Modèle et clé via env (ANTHROPIC_MODEL / ANTHROPIC_API_KEY).
   Conventions Claude Fable 5 (cf. skill claude-api) : pas de
   paramètre `thinking` (toujours actif), pas de temperature,
   effort via output_config, sorties structurées via
   output_config.format (jamais de prefill).
   ============================================================ */

/** Vrai si l'IA est configurée (clé + modèle présents). */
export function hasAi(): boolean {
  const { ANTHROPIC_API_KEY, ANTHROPIC_MODEL } = env();
  return Boolean(ANTHROPIC_API_KEY && ANTHROPIC_MODEL);
}

let cached: Anthropic | null | undefined;

function client(): Anthropic {
  if (cached === undefined) {
    const { ANTHROPIC_API_KEY } = env();
    cached = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;
  }
  if (!cached) throw new Error("IA non configurée (ANTHROPIC_API_KEY manquant).");
  return cached;
}

export type GenerationResult<T> = {
  data: T;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** null si le modèle n'est pas au barème (évite de fausser les totaux). */
  costUsd: number | null;
};

/* Barème $/1M tokens des modèles connus (in / out). null → coût non calculé. */
const PRICING: Record<string, { in: number; out: number }> = {
  "claude-fable-5": { in: 10, out: 50 },
  "claude-opus-4-8": { in: 5, out: 25 },
  "claude-sonnet-5": { in: 3, out: 15 },
  "claude-haiku-4-5": { in: 1, out: 5 },
};

function computeCost(
  model: string,
  inTok: number,
  outTok: number,
): number | null {
  const rate = PRICING[model];
  if (!rate) return null;
  return (inTok * rate.in + outTok * rate.out) / 1_000_000;
}

/**
 * Génère un objet JSON validé contre `schema` (JSON Schema) à partir d'un
 * prompt. Utilise output_config.format (structured outputs) : la réponse
 * respecte le schéma, aucun parsing fragile. Lève si l'IA refuse ou si la
 * réponse est vide.
 */
export async function generateStructured<T>(input: {
  system: string;
  user: string;
  schema: Record<string, unknown>;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  maxTokens?: number;
}): Promise<GenerationResult<T>> {
  const model = env().ANTHROPIC_MODEL!;
  const response = await client().messages.create({
    model,
    max_tokens: input.maxTokens ?? 8000,
    system: input.system,
    output_config: {
      effort: input.effort ?? "high",
      format: {
        type: "json_schema",
        schema: input.schema,
      },
    },
    messages: [{ role: "user", content: input.user }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Génération refusée par le modèle (contenu sensible ?).");
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Réponse IA vide.");
  }

  let data: T;
  try {
    data = JSON.parse(textBlock.text) as T;
  } catch {
    throw new Error("Réponse IA non-JSON malgré le format structuré.");
  }

  const inTok = response.usage.input_tokens;
  const outTok = response.usage.output_tokens;
  return {
    data,
    model,
    inputTokens: inTok,
    outputTokens: outTok,
    costUsd: computeCost(model, inTok, outTok),
  };
}
