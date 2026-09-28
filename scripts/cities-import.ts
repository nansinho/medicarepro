/**
 * Importe des pages villes rédigées hors API (fichiers <slug>.json, format
 * décrit par scripts/cities-brief.ts) en leur appliquant le contrôle
 * qualité SEO (src/lib/ai/city-quality.ts) contre toutes les pages déjà
 * rédigées et celles du lot. Une page conforme passe en 'approved' ; une
 * page refusée n'est pas enregistrée et la liste de ses problèmes s'affiche,
 * pour correction puis nouvel import. Rien n'est publié ici.
 *
 * Usage (depuis la racine du repo) :
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/cities-import.ts --dir <dossier>          → contrôle seul
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/cities-import.ts --dir <dossier> --apply  → enregistrement
 */
import fs from "node:fs";
import path from "node:path";
import { serviceClient } from "../src/lib/supabase/service";
import {
  cityAngle,
  loadCityForGeneration,
  loadOtherPages,
  saveCheckedCity,
  toOtherPage,
  type GeneratedCityPage,
} from "../src/lib/ai/city-generator";
import { checkCityPage } from "../src/lib/ai/city-quality";
import { cityTitle } from "../src/lib/cms/city-data";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const DIR = arg("dir");
const APPLY = process.argv.includes("--apply");
/** Auteur tracé dans ai_generations.model. */
const AUTHOR = "claude-code (session)";

type Written = {
  seo_title: string;
  seo_description: string;
  h1: string;
  content: { intro: string; contexte_local: string; benefices: string; claims_to_verify?: string[] };
  faq: { q: string; a: string }[];
};

async function main() {
  const service = serviceClient();
  if (!service || !DIR) {
    console.error("Usage : --dir <dossier> [--apply] (variables Supabase requises).");
    process.exit(1);
  }
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".json"));
  const others = await loadOtherPages(service);
  console.log(`${files.length} page(s) à contrôler · ${others.length} page(s) déjà rédigée(s) pour comparaison\n`);

  let ok = 0;
  for (const file of files) {
    const slug = file.replace(/\.json$/, "");
    const { data: row } = await service.from("cities").select("id, status").eq("slug", slug).maybeSingle();
    if (!row) {
      console.log(`✖ ${slug} : ville inconnue`);
      continue;
    }
    if (row.status === "published") {
      console.log(`· ${slug} : déjà publiée, ignorée`);
      continue;
    }
    const city = await loadCityForGeneration(service, row.id);
    if (!city) {
      console.log(`✖ ${slug} : sans données locales`);
      continue;
    }
    let written: Written;
    try {
      written = JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8")) as Written;
    } catch (err) {
      console.log(`✖ ${slug} : JSON illisible (${err instanceof Error ? err.message : err})`);
      continue;
    }
    const page: GeneratedCityPage = {
      /* Titre imposé (une cible unique par page), quel que soit le fichier. */
      seo_title: cityTitle(city.name_locative, city.dept_code, city.local_data.homonyme),
      seo_description: written.seo_description.trim(),
      h1: written.h1.trim(),
      content: {
        intro: written.content.intro.trim(),
        contexte_local: written.content.contexte_local.trim(),
        benefices: written.content.benefices.trim(),
        meta_description: written.seo_description.trim(),
        claims_to_verify: written.content.claims_to_verify ?? [],
      },
      faq: written.faq.map((f) => ({ q: f.q.trim(), a: f.a.trim() })),
    };
    const report = checkCityPage(page, {
      cityName: city.name,
      deptName: city.dept_name,
      data: city.local_data,
      others: others.filter((o) => o.slug !== slug),
    });
    const sim = `ressemblance max ${Math.round(report.maxSimilarity * 100)} % (${report.closestSlug ?? "-"})`;
    if (!report.ok) {
      console.log(`✖ ${slug} · ${sim} · ${report.issues.map((i) => `${i.code} (${i.detail})`).join(" ; ")}`);
      continue;
    }
    ok++;
    console.log(`✔ ${slug} · ${sim}`);
    if (APPLY) {
      await saveCheckedCity(service, city, {
        page,
        report,
        attempts: 1,
        model: AUTHOR,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: null,
        angle: cityAngle(city.name, city.local_data),
      });
    }
    const self = toOtherPage({ ...city, ...page });
    if (self) others.push(self);
  }
  console.log(`\n${ok}/${files.length} page(s) conforme(s)${APPLY ? ", enregistrée(s) en 'approved'" : " (contrôle seul : ajouter --apply)"}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
