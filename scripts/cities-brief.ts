/**
 * Sort les fiches de rédaction des pages villes, pour une rédaction hors API
 * (session Claude Code) : mêmes consignes et mêmes données que le générateur
 * automatique (src/lib/ai/city-generator.ts). Les pages écrites reviennent
 * par scripts/cities-import.ts, qui applique le contrôle qualité.
 *
 * Usage (depuis la racine du repo) :
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/cities-brief.ts --wave 1 --out <dossier> [--limit N]
 *   … --slug tarbes --out <dossier>      → une ville précise
 *   … --retry                            → inclut les villes en 'needs_review'
 *
 * Écrit <dossier>/_consignes.md (une fois) et <dossier>/<slug>.md (une par ville).
 */
import fs from "node:fs";
import path from "node:path";
import { serviceClient } from "../src/lib/supabase/service";
import { buildCityPrompt, CITY_SYSTEM_PROMPT, loadCityForGeneration } from "../src/lib/ai/city-generator";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const OUT = arg("out");
const WAVE = arg("wave") ? Number(arg("wave")) : null;
const SLUG = arg("slug");
const LIMIT = arg("limit") ? Number(arg("limit")) : 10_000;
const RETRY = process.argv.includes("--retry");

const FORMAT = `Format de sortie : un fichier <slug>.json par ville, de cette forme exacte :

{
  "seo_title": "…",
  "seo_description": "…",
  "h1": "…",
  "content": { "intro": "…", "contexte_local": "…", "benefices": "…", "claims_to_verify": [] },
  "faq": [ { "q": "…", "a": "…" } ]
}`;

async function main() {
  const service = serviceClient();
  if (!service || !OUT || (!WAVE && !SLUG)) {
    console.error("Usage : --wave N | --slug <ville>, --out <dossier> (variables Supabase requises).");
    process.exit(1);
  }
  let query = service.from("cities").select("id, slug").order("population", { ascending: false });
  if (SLUG) query = query.eq("slug", SLUG);
  else query = query.eq("wave", WAVE!).in("status", RETRY ? ["seeded", "needs_review"] : ["seeded"]);
  const { data, error } = await query.range(0, LIMIT - 1);
  if (error) throw new Error(error.message);

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "_consignes.md"), `${CITY_SYSTEM_PROMPT}\n\n${FORMAT}\n`);
  let n = 0;
  for (const row of data ?? []) {
    const city = await loadCityForGeneration(service, row.id);
    if (!city) continue;
    fs.writeFileSync(path.join(OUT, `${city.slug}.md`), `${buildCityPrompt(city)}\n`);
    n++;
  }
  console.log(`${n} fiche(s) écrite(s) dans ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
