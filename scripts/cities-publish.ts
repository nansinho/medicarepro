/**
 * Publie les pages villes validées (status 'approved') d'une vague, ou d'une
 * liste de villes précise.
 * Seules les pages passées au contrôle qualité automatique sont
 * concernées ; celles en 'needs_review' restent bloquées.
 *
 * Usage (depuis la racine du repo) :
 *   npx tsx --env-file=.env.local scripts/cities-publish.ts --wave 1              → simulation
 *   npx tsx --env-file=.env.local scripts/cities-publish.ts --wave 1 --apply      → publication
 *   … --limit 50                → au plus 50 villes (les plus peuplées d'abord)
 *   … --slugs lyon,tarbes       → ces villes-là, quelle que soit leur vague (à la place de --wave)
 *   … --deploy                  → relance ensuite le site (Coolify) : nouvelles
 *                                 pages pré-rendues, cache et plan du site à jour
 *
 * Publier par lots progressifs (quelques centaines à la fois) plutôt que
 * des milliers d'un coup : l'indexation suit mieux et les signaux Search
 * Console restent lisibles.
 */
import { createClient } from "@supabase/supabase-js";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const WAVE = arg("wave") ? Number(arg("wave")) : null;
const SLUGS = arg("slugs")?.split(",").map((s) => s.trim()).filter(Boolean) ?? null;
const LIMIT = arg("limit") ? Number(arg("limit")) : 10_000;
const APPLY = process.argv.includes("--apply");
const DEPLOY = process.argv.includes("--deploy");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || (!WAVE && !SLUGS)) {
  console.error("Usage : --wave N ou --slugs a,b,c (NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis).");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

async function deploy() {
  const api = process.env.COOLIFY_API_URL?.replace(/\/+$/, "");
  const token = process.env.COOLIFY_DEPLOY_TOKEN;
  const uuid = process.env.COOLIFY_APP_UUID;
  if (!api || !token || !uuid) {
    console.log("Déploiement non lancé : COOLIFY_API_URL, COOLIFY_DEPLOY_TOKEN et COOLIFY_APP_UUID requis.");
    return;
  }
  const headers = { Authorization: `Bearer ${token}` };
  /* force=true : même commit que le déploiement précédent → sans cela, Docker
     réutilise l'ancien build (pages pré-rendues sans les villes publiées). */
  const res = await fetch(`${api}/api/v1/deploy?uuid=${uuid}&force=true`, { method: "POST", headers });
  const body = (await res.json()) as { deployments?: { deployment_uuid: string }[] };
  const id = body.deployments?.[0]?.deployment_uuid;
  if (!id) throw new Error(`Déploiement refusé : ${JSON.stringify(body)}`);
  console.log(`Déploiement ${id} lancé…`);
  for (;;) {
    await new Promise((r) => setTimeout(r, 10_000));
    const d = (await (await fetch(`${api}/api/v1/deployments/${id}`, { headers })).json()) as { status: string };
    if (["finished", "failed", "cancelled"].includes(d.status)) {
      console.log(`Déploiement ${d.status}.`);
      if (d.status !== "finished") process.exit(1);
      return;
    }
  }
}

async function main() {
  let scope = sb.from("cities").select("slug, status");
  scope = SLUGS ? scope.in("slug", SLUGS) : scope.eq("wave", WAVE!);
  const counts = await scope.range(0, 9999);
  if (counts.error) throw new Error(counts.error.message);
  const byStatus: Record<string, number> = {};
  for (const r of counts.data ?? []) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  console.log(`${SLUGS ? `${SLUGS.length} ville(s) demandée(s)` : `Vague ${WAVE}`} : ${Object.entries(byStatus).map(([s, n]) => `${s} ${n}`).join(" · ")}`);
  if (SLUGS) {
    const missing = SLUGS.filter((slug) => !(counts.data ?? []).some((r) => r.slug === slug));
    if (missing.length) console.log(`Villes inconnues : ${missing.join(", ")}`);
    const blocked = (counts.data ?? []).filter((r) => r.status !== "approved" && r.status !== "published");
    if (blocked.length) console.log(`Non validées (non publiées) : ${blocked.map((r) => `${r.slug} (${r.status})`).join(", ")}`);
  }

  let query = sb.from("cities").select("id, slug").eq("status", "approved");
  query = SLUGS ? query.in("slug", SLUGS) : query.eq("wave", WAVE!);
  const { data: ready, error } = await query.order("population", { ascending: false }).range(0, LIMIT - 1);
  if (error) throw new Error(error.message);
  const list = ready ?? [];
  console.log(`${list.length} page(s) validée(s) à publier${list.length ? ` (ex. ${list.slice(0, 5).map((c) => c.slug).join(", ")})` : ""}.`);

  if (!APPLY || list.length === 0) {
    if (!APPLY) console.log("Simulation : ajouter --apply pour publier.");
    return;
  }
  const now = new Date().toISOString();
  for (let i = 0; i < list.length; i += 500) {
    const ids = list.slice(i, i + 500).map((c) => c.id);
    const { error: upError } = await sb
      .from("cities")
      .update({ status: "published", published_at: now })
      .in("id", ids)
      .eq("status", "approved");
    if (upError) throw new Error(upError.message);
  }
  console.log(`✔ ${list.length} page(s) publiée(s).`);
  if (DEPLOY) await deploy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
