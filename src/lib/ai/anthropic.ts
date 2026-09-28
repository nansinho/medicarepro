import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

/* ============================================================
   Client Anthropic (génération de contenu IA — pages villes).
   Modèle et clé via env (ANTHROPIC_MODEL / ANTHROPIC_API_KEY),
   modèle conseillé : claude-opus-5. Conventions des modèles
   actuels (cf. skill claude-api) : réflexion adaptative active
   par défaut (pas de paramètre `thinking`), pas de temperature,
   effort via output_config, sorties structurées via
   output_config.format (jamais de prefill). Repli serveur sur un
   second modèle si le premier décline la demande.
   ============================================================ */

/** Modèle de repli si le modèle principal décline (refusal). */
const FALLBACK_MODEL = "claude-opus-4-8";

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
  /** Modèle qui a réellement répondu (le repli, le cas échéant). */
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** null si le modèle n'est pas au barème (évite de fausser les totaux). */
  costUsd: number | null;
};

/* Barème $/1M tokens (in / out), tarifs publics Anthropic.
   null → coût non calculé. */
const PRICING: Record<string, { in: number; out: number }> = {
  "claude-fable-5-1": { in: 10, out: 50 },
  "claude-fable-5": { in: 10, out: 50 },
  "claude-opus-5-5": { in: 4, out: 20 },
  "claude-opus-5": { in: 5, out: 25 },
  "claude-opus-4-8": { in: 5, out: 25 },
  "claude-sonnet-5": { in: 2, out: 10 },
  "claude-haiku-4-5": { in: 1, out: 5 },
};

function computeCost(model: string, inTok: number, outTok: number): number | null {
  const rate = PRICING[model];
  if (!rate) return null;
  return (inTok * rate.in + outTok * rate.out) / 1_000_000;
}

/**
 * Génère un objet JSON validé contre `schema` (JSON Schema) à partir d'un
 * prompt. Utilise output_config.format (structured outputs) : la réponse
 * respecte le schéma, aucun parsing fragile. Lève si toute la chaîne
 * (modèle principal puis repli) décline, ou si la réponse est vide/tronquée.
 */
export async function generateStructured<T>(input: {
  system: string;
  user: string;
  schema: Record<string, unknown>;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  maxTokens?: number;
}): Promise<GenerationResult<T>> {
  const model = env().ANTHROPIC_MODEL!;
  const response = await client().beta.messages.create({
    model,
    /* La réflexion compte dans ce plafond : large, pour ne jamais tronquer. */
    max_tokens: input.maxTokens ?? 16000,
    system: input.system,
    output_config: {
      effort: input.effort ?? "high",
      format: { type: "json_schema", schema: input.schema },
    },
    ...(model !== FALLBACK_MODEL
      ? { betas: ["server-side-fallback-2026-06-01"], fallbacks: [{ model: FALLBACK_MODEL }] }
      : {}),
    messages: [{ role: "user", content: input.user }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Génération refusée par le modèle (contenu sensible ?).");
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("Réponse IA tronquée (plafond de tokens atteint).");
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
    model: response.model,
    inputTokens: inTok,
    outputTokens: outTok,
    costUsd: computeCost(response.model, inTok, outTok),
  };
}
