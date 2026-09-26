/**
 * Accueil : l'écran de l'agenda cède la place à la nouvelle consultation
 * (traçabilité des kits stérilisés) dans le haut de page.
 *
 * Usage (depuis la racine du repo, variables de .env.local chargées) :
 *   npx tsx --env-file=.env.local scripts/hero-consultation-sync.ts            → simulation
 *   npx tsx --env-file=.env.local scripts/hero-consultation-sync.ts --apply    → écriture
 *
 * À lancer APRÈS le déploiement du code qui connaît l'écran « consultation » :
 * l'ancien code rejetterait le bloc (type d'écran inconnu) et reviendrait au
 * contenu de secours. Puis purger le cache : POST /api/cron/revalidate-content
 * (Bearer CRON_SECRET de production).
 *
 * Ne touche que `mockup` et `highlight` du bloc « hero_split » de l'accueil ;
 * le reste du bloc (titres, boutons, preuves) reste tel qu'édité en base.
 */
import { createClient } from "@supabase/supabase-js";
import { SectionContentSchema } from "../src/lib/cms/sections.schema";
import { PAGE_HOME } from "../src/data/content/home";

const APPLY = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

type Json = Record<string, unknown>;
const SECTION = "hero_split";

async function main() {
  console.log(APPLY ? "Écriture en base…\n" : "Simulation (aucune écriture). Ajouter --apply pour écrire.\n");

  const code = (PAGE_HOME.sections as unknown as { key: string; content: Json }[]).find(
    (s) => s.key === SECTION,
  )?.content;
  if (!code) throw new Error(`Bloc « ${SECTION} » absent du contenu de l'accueil`);

  const { data: page, error: pageErr } = await sb.from("pages").select("id").eq("slug", "/").maybeSingle();
  if (pageErr || !page) throw new Error("Page d'accueil introuvable en base");

  const { data: row, error: rowErr } = await sb
    .from("page_sections")
    .select("content")
    .eq("page_id", page.id)
    .eq("section_key", SECTION)
    .maybeSingle();
  if (rowErr) throw rowErr;
  if (!row) throw new Error(`Bloc « ${SECTION} » absent en base`);

  const current = row.content as Json;
  const next: Json = { ...current, mockup: code.mockup, highlight: code.highlight };
  SectionContentSchema.parse(next);

  const before = JSON.stringify({ mockup: current.mockup, highlight: current.highlight });
  const after = JSON.stringify({ mockup: next.mockup, highlight: next.highlight });
  if (before === after) {
    console.log(`· / · « ${SECTION} » déjà à jour`);
    return;
  }
  console.log(`${APPLY ? "✔" : "·"} / · « ${SECTION} »`);
  console.log(`    avant : ${before}`);
  console.log(`    après : ${after}`);

  if (APPLY) {
    const { error } = await sb
      .from("page_sections")
      .update({ content: next, updated_at: new Date().toISOString() })
      .eq("page_id", page.id)
      .eq("section_key", SECTION);
    if (error) throw error;
  }
  console.log(`\n${APPLY ? "Terminé. Purger le cache : POST /api/cron/revalidate-content." : "Simulation terminée."}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
