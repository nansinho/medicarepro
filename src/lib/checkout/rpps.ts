/* ============================================================
   Vérification du numéro RPPS contre l'Annuaire Santé (ANS).

   L'API FHIR « Annuaire Santé » est gratuite mais exige une clé
   (inscription sur le portail e-santé). Tant que la variable
   ANNUAIRE_SANTE_API_KEY n'est pas posée, la vérification est
   SAUTÉE (le format 11 chiffres reste contrôlé par le schéma).

   FAIL-OPEN : une panne de l'annuaire ne doit jamais empêcher une
   inscription — seul un « introuvable » certain (API joignable,
   zéro résultat) est bloquant côté checkout.
   ============================================================ */

export type RppsCheckOutcome = "valid" | "not_found" | "unavailable" | "skipped";

const DEFAULT_FHIR_BASE = "https://gateway.api.esante.gouv.fr/fhir/v2";

export async function verifyRppsOnline(rpps: string): Promise<RppsCheckOutcome> {
  const apiKey = process.env.ANNUAIRE_SANTE_API_KEY?.trim();
  if (!apiKey) return "skipped";

  const base = (process.env.ANNUAIRE_SANTE_API_URL ?? DEFAULT_FHIR_BASE).replace(
    /\/$/,
    "",
  );

  try {
    const res = await fetch(
      `${base}/Practitioner?identifier=${encodeURIComponent(rpps)}`,
      {
        headers: {
          accept: "application/fhir+json",
          // Les deux intitulés circulent selon la version du portail ANS.
          "ESANTE-API-KEY": apiKey,
          "GRAVITEE-API-KEY": apiKey,
        },
        signal: AbortSignal.timeout(4_000),
        cache: "no-store",
      },
    );
    if (!res.ok) {
      console.warn(`[rpps] Annuaire Santé HTTP ${res.status} — vérification sautée`);
      return "unavailable";
    }
    const bundle = (await res.json()) as {
      total?: number;
      entry?: unknown[];
    };
    const found =
      (typeof bundle.total === "number" && bundle.total > 0) ||
      (Array.isArray(bundle.entry) && bundle.entry.length > 0);
    return found ? "valid" : "not_found";
  } catch {
    console.warn("[rpps] Annuaire Santé injoignable — vérification sautée");
    return "unavailable";
  }
}
