/**
 * Génère les pages villes d'une vague, en local, avec contrôle qualité SEO
 * automatique (src/lib/ai/city-quality.ts) : une page conforme passe en
 * 'approved', une page qui échoue après 3 essais reste en 'needs_review'.
 * Rien n'est publié ici (cf. scripts/cities-publish.ts).
 *
 * Prérequis dans .env.local : ANTHROPIC_API_KEY, ANTHROPIC_MODEL (claude-opus-5).
 *
 * Usage (depuis la racine du repo) :
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/cities-generate.ts --wave 1 --limit 3
 *   … --wave 1                  → toutes les villes « seeded » de la vague 1
 *   … --slug tarbes             → une ville précise (quel que soit son statut non publié)
 *   … --wave 1 --retry          → reprend aussi les villes en 'needs_review'
 *   … --wave 1 --recheck        → recontrôle toutes les pages générées entre elles, sans IA
 *   --concurrency N (défaut 3)
 *
 * --conditions=react-server : les modules serveur importent « server-only ».
 */
import { serviceClient } from "../src/lib/supabase/service";
import { hasAi } from "../src/lib/ai/anthropic";
import {
  generateCheckedCity,
  loadCityForGeneration,
  loadOtherPages,
  saveCheckedCity,
  toOtherPage,
  type OtherPage,
} from "../src/lib/ai/city-generator";
import { checkCityPage, type CityPageDraft } from "../src/lib/ai/city-quality";
import { isLocalData } from "../src/lib/cms/city-data";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const WAVE = arg("wave") ? Number(arg("wave")) : null;
const SLUG = arg("slug");
const LIMIT = arg("limit") ? Number(arg("limit")) : Infinity;
const CONCURRENCY = arg("concurrency") ? Number(arg("concurrency")) : 3;
const RETRY = process.argv.includes("--retry");
const RECHECK = process.argv.includes("--recheck");

const service = serviceClient();
if (!service) {
  console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.");
  process.exit(1);
}
if (!WAVE && !SLUG) {
  console.error("Préciser --wave N ou --slug <ville>.");
  process.exit(1);
}

async function targets(): Promise<{ id: string; slug: string }[]> {
  let query = service!.from("cities").select("id, slug").order("population", { ascending: false });
  if (SLUG) query = query.eq("slug", SLUG).neq("status", "published");
  else query = query.eq("wave", WAVE!).in("status", RETRY ? ["seeded", "needs_review"] : ["seeded"]);
  const { data, error } = await query.range(0, 9999);
  if (error) throw new Error(error.message);
  return (data ?? []).slice(0, LIMIT);
}

async function generate() {
  if (!hasAi()) {
    console.error("ANTHROPIC_API_KEY et ANTHROPIC_MODEL doivent être renseignés dans .env.local.");
    process.exit(1);
  }
  const list = await targets();
  const others = await loadOtherPages(service!);
  console.log(`${list.length} ville(s) à générer · ${others.length} page(s) déjà générée(s) pour comparaison\n`);

  let done = 0;
  let approved = 0;
  let cost = 0;
  const queue = [...list];
  async function worker() {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const city = await loadCityForGeneration(service!, next.id);
      if (!city) {
        console.log(`✖ ${next.slug} : sans données locales, ignorée`);
        continue;
      }
      try {
        const result = await generateCheckedCity(city, others);
        await saveCheckedCity(service!, city, result);
        const self = toOtherPage({ ...city, ...result.page });
        if (self) others.push(self);
        done++;
        if (result.report.ok) approved++;
        cost += result.costUsd ?? 0;
        const sim = Math.round(result.report.maxSimilarity * 100);
        console.log(
          `${result.report.ok ? "✔" : "✖"} [${done}/${list.length}] ${city.slug} · ${result.attempts} essai(s) · ` +
            `ressemblance max ${sim} % (${result.report.closestSlug ?? "-"}) · ${(result.costUsd ?? 0).toFixed(3)} $` +
            (result.report.ok ? "" : ` · ${result.report.issues.map((i) => `${i.code} (${i.detail})`).join(" ; ")}`),
        );
      } catch (err) {
        console.log(`✖ ${city.slug} : ${err instanceof Error ? err.message : err}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length) }, worker));
  console.log(`\n${approved}/${done} page(s) conforme(s) · coût total ${cost.toFixed(2)} $`);
}

/** Recontrôle toutes les pages non publiées de la vague contre toutes les autres. */
async function recheck() {
  const { data, error } = await service!
    .from("cities")
    .select("id, slug, name, dept_name, status, seo_title, h1, seo_description, content, faq, local_data, quality")
    .eq("wave", WAVE!)
    .in("status", ["approved", "needs_review"])
    .range(0, 9999);
  if (error) throw new Error(error.message);
  const all: OtherPage[] = await loadOtherPages(service!);
  let changed = 0;
  for (const row of data ?? []) {
    if (!isLocalData(row.local_data)) continue;
    const page = { ...row, content: row.content, faq: row.faq } as unknown as CityPageDraft;
    const report = checkCityPage(page, {
      cityName: row.name,
      deptName: row.dept_name,
      data: row.local_data,
      others: all.filter((o) => o.slug !== row.slug),
    });
    const status = report.ok ? "approved" : "needs_review";
    if (status !== row.status) {
      changed++;
      console.log(`${report.ok ? "✔" : "✖"} ${row.slug} : ${row.status} → ${status} ${report.issues.map((i) => i.code).join(", ")}`);
    }
    await service!
      .from("cities")
      .update({
        status,
        quality: {
          ...(row.quality as object),
          ok: report.ok,
          issues: report.issues,
          maxSimilarity: Math.round(report.maxSimilarity * 1000) / 1000,
          closestSlug: report.closestSlug,
          checkedAt: new Date().toISOString(),
        },
      })
      .eq("id", row.id);
  }
  console.log(`${data?.length ?? 0} page(s) recontrôlée(s), ${changed} changement(s) de statut.`);
}

(RECHECK ? recheck() : generate()).catch((err) => {
  console.error(err);
  process.exit(1);
});
