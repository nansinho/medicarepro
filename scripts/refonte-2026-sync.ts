/**
 * Synchronisation du contenu en base pour la refonte 2026 de la vitrine.
 *
 * Usage (depuis la racine du repo, variables de .env.local chargées) :
 *   npx tsx --env-file=.env.local scripts/refonte-2026-sync.ts            → simulation
 *   npx tsx --env-file=.env.local scripts/refonte-2026-sync.ts --apply    → écriture
 *
 * À lancer APRÈS le déploiement du nouveau code : l'ancien site afficherait
 * sinon le nouveau menu et le bandeau promo dans l'ancien habillage. Puis
 * purger le cache : POST /api/cron/revalidate-content (Bearer CRON_SECRET).
 *
 * Ce que fait le script :
 *  1. Accueil : crée les nouveaux blocs (clés nouvelles) s'ils n'existent pas.
 *     Les anciens blocs (hero, bento…) restent en base, inutilisés : retour
 *     arrière possible en redéployant l'ancien code.
 *  2. Pages intérieures : ajoute aux en-têtes les champs de la refonte
 *     (boutons, photo, écran) s'ils manquent, sans toucher au reste ; remplace
 *     les tonalités de fond (nouvelle alternance blanc / couleur).
 *  3. Menu principal, bandeau promo et réseaux sociaux : valeurs de la
 *     refonte. L'icône YouTube n'existe pas dans l'ancien code : son pied de
 *     page planterait (toutes les pages) si elle arrivait en base avant.
 * Chaque contenu écrit est validé par le schéma zod du CMS.
 */
import { createClient } from "@supabase/supabase-js";
import { SectionContentSchema } from "../src/lib/cms/sections.schema";
import { PAGE_HOME } from "../src/data/content/home";
import { PAGE_FONCTIONNALITES } from "../src/data/content/fonctionnalites";
import { PAGE_BILANS } from "../src/data/content/bilans";
import { PAGE_SECURITE } from "../src/data/content/securite";
import { PAGE_AVANTAGES } from "../src/data/content/avantages";
import { PAGE_A_PROPOS } from "../src/data/content/a-propos";
import { MENUS, SETTINGS } from "../src/data/content/site";
import { SETTINGS_SCHEMAS } from "../src/lib/admin/settings-forms";

const APPLY = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

type Json = Record<string, unknown>;
type Slot = { key: string; type: string; content: Json };

const log = (msg: string) => console.log(`${APPLY ? "✔" : "·"} ${msg}`);

async function pageId(slug: string): Promise<string> {
  const { data, error } = await sb.from("pages").select("id").eq("slug", slug).maybeSingle();
  if (error || !data) throw new Error(`Page ${slug} introuvable en base`);
  return data.id as string;
}

async function rows(id: string): Promise<Map<string, { content: Json }>> {
  const { data, error } = await sb
    .from("page_sections")
    .select("section_key, content")
    .eq("page_id", id);
  if (error) throw error;
  return new Map((data ?? []).map((r) => [r.section_key as string, { content: r.content as Json }]));
}

/** Valide contre le schéma du CMS (lève si invalide) et rend le contenu tel
 *  quel : pas de réécriture des champs existants ni de l'ordre des clés. */
function valid(content: Json): Json {
  SectionContentSchema.parse(content);
  return content;
}

/** Comparaison de valeurs indépendante de l'ordre des clés. */
function same(a: unknown, b: unknown): boolean {
  const norm = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(norm)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.keys(v as Json)
              .sort()
              .map((k) => [k, norm((v as Json)[k])]),
          )
        : v;
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}

/* 1. Accueil : nouveaux blocs */
async function syncHome() {
  const id = await pageId("/");
  const existing = await rows(id);
  const slots = PAGE_HOME.sections as unknown as Slot[];
  for (const [position, slot] of slots.entries()) {
    if (existing.has(slot.key)) {
      log(`/ · « ${slot.key} » déjà en base, conservé`);
      continue;
    }
    log(`/ · création du bloc « ${slot.key} » (${slot.type})`);
    if (APPLY) {
      const { error } = await sb.from("page_sections").insert({
        page_id: id,
        section_key: slot.key,
        position,
        type: slot.type,
        content: valid(slot.content),
      });
      if (error) throw error;
    }
  }
}

/* 2. Pages intérieures : champs ajoutés par la refonte */
const HERO_FIELDS = ["ctas", "image", "imagePos", "mockup", "sub"] as const;

async function patchSection(
  slug: string,
  slots: Slot[],
  sectionKey: string,
  merge: (db: Json, fallback: Json) => Json,
) {
  const id = await pageId(slug);
  const existing = await rows(id);
  const row = existing.get(sectionKey);
  const fallback = slots.find((s) => s.key === sectionKey)?.content;
  if (!row || !fallback) {
    log(`${slug} · « ${sectionKey} » absent, ignoré`);
    return;
  }
  const next = valid(merge(row.content, fallback));
  if (same(next, row.content)) {
    log(`${slug} · « ${sectionKey} » déjà à jour`);
    return;
  }
  const changed = Object.keys(next).filter((k) => !same(next[k], row.content[k]));
  log(`${slug} · « ${sectionKey} » : ${changed.join(", ")}`);
  if (APPLY) {
    const { error } = await sb
      .from("page_sections")
      .update({ content: next, updated_at: new Date().toISOString() })
      .eq("page_id", id)
      .eq("section_key", sectionKey);
    if (error) throw error;
  }
}

/** Ajoute les champs d'en-tête manquants, garde ceux réglés dans le back office. */
const addHeroFields = (db: Json, fb: Json): Json => {
  const out = { ...db };
  for (const f of HERO_FIELDS) if (out[f] === undefined && fb[f] !== undefined) out[f] = fb[f];
  return out;
};
const takeTones = (db: Json, fb: Json): Json => ({ ...db, tones: fb.tones });
const takeTone = (db: Json, fb: Json): Json => ({ ...db, tone: fb.tone });

async function syncPages() {
  const pages: { slug: string; slots: Slot[]; hero: boolean; tones?: string; tone?: string[] }[] = [
    { slug: "/fonctionnalites", slots: PAGE_FONCTIONNALITES.sections as unknown as Slot[], hero: true, tones: "showcase" },
    { slug: "/bilans", slots: PAGE_BILANS.sections as unknown as Slot[], hero: true, tones: "showcase" },
    {
      slug: "/securite",
      slots: PAGE_SECURITE.sections as unknown as Slot[],
      hero: true,
      tone: ["showcase_1", "showcase_2", "showcase_3", "showcase_4"],
    },
    {
      slug: "/avantages",
      slots: PAGE_AVANTAGES.sections as unknown as Slot[],
      hero: true,
      tone: ["showcase_1", "showcase_2", "showcase_3", "showcase_4", "showcase_5"],
    },
    { slug: "/a-propos", slots: PAGE_A_PROPOS.sections as unknown as Slot[], hero: true },
  ];
  for (const p of pages) {
    if (p.hero) await patchSection(p.slug, p.slots, "hero", addHeroFields);
    if (p.tones) await patchSection(p.slug, p.slots, p.tones, takeTones);
    for (const k of p.tone ?? []) await patchSection(p.slug, p.slots, k, takeTone);
  }
}

/* 3. Menu principal et bandeau promo */
async function syncChrome() {
  log("menu principal : Le logiciel · Nos services · Partout en France · Ressources");
  if (APPLY) {
    const { error } = await sb
      .from("menus")
      .upsert({ key: "header", items: MENUS.header, updated_at: new Date().toISOString() });
    if (error) throw error;
  }
  log(`bandeau promo : « ${SETTINGS.promoBanner.text} »`);
  if (APPLY) {
    const { error } = await sb.from("site_settings").upsert({
      key: "promoBanner",
      value: SETTINGS.promoBanner,
      is_public: true,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  }

  /* Réseaux : liste du pied de page et du bord gauche, et celle du panneau
     du menu (seul `drawer.socials` change, le reste de l'en-tête est gardé). */
  const socials = SETTINGS_SCHEMAS.socials.parse(SETTINGS.socials);
  log(`réseaux sociaux : ${socials.map((s) => s.label).join(" · ")}`);
  const { data: headerRow, error: headerErr } = await sb
    .from("site_settings")
    .select("value")
    .eq("key", "header")
    .maybeSingle();
  if (headerErr) throw headerErr;
  const header = (headerRow?.value as Json | undefined) ?? SETTINGS.header;
  const nextHeader = SETTINGS_SCHEMAS.header.parse({
    ...header,
    drawer: { ...(header.drawer as Json), socials },
  });
  if (APPLY) {
    const now = new Date().toISOString();
    const { error } = await sb
      .from("site_settings")
      .upsert([
        { key: "socials", value: socials, is_public: true, updated_at: now },
        { key: "header", value: nextHeader, is_public: true, updated_at: now },
      ]);
    if (error) throw error;
  }
}

/* 4. Textes : MediCare Pro n'a pas d'application mobile native, c'est une
   PWA (application web installable). Remplacements exacts, partout où la
   formulation apparaît (sections publiées et brouillons, fonctionnalités,
   métadonnées SEO). */
const WORDING: [string, string][] = [
  ["application mobile (PWA)", "accès sur mobile (PWA)"],
  ["bilans et application mobile", "bilans et accès sur mobile (PWA)"],
  ["App mobile (PWA) + scan de documents", "Sur mobile et tablette (PWA) + scan de documents"],
];

function reword(value: unknown): unknown {
  if (typeof value === "string") return WORDING.reduce((s, [a, b]) => s.split(a).join(b), value);
  if (Array.isArray(value)) return value.map(reword);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Json).map(([k, v]) => [k, reword(v)]));
  }
  return value;
}

async function syncWording() {
  const tables: { table: string; key: string; columns: string[] }[] = [
    { table: "page_sections", key: "id", columns: ["content", "draft"] },
    { table: "feature_items", key: "id", columns: ["title", "text", "points"] },
    { table: "seo_meta", key: "id", columns: ["title", "description", "og_title", "og_description"] },
  ];
  for (const { table, key, columns } of tables) {
    const { data, error } = await sb.from(table).select("*");
    if (error) throw error;
    for (const row of (data ?? []) as Json[]) {
      const patch: Json = {};
      for (const col of columns) {
        if (!(col in row) || row[col] == null) continue;
        const next = reword(row[col]);
        if (!same(next, row[col])) patch[col] = next;
      }
      if (Object.keys(patch).length === 0) continue;
      if (table === "page_sections" && patch.content) valid(patch.content as Json);
      log(`${table} ${String(row.section_key ?? row.path ?? row[key])} : « application mobile » → PWA (${Object.keys(patch).join(", ")})`);
      if (APPLY) {
        const { error: err } = await sb.from(table).update(patch).eq(key, row[key] as string);
        if (err) throw err;
      }
    }
  }
}

async function main() {
  console.log(APPLY ? "Écriture en base…\n" : "Simulation (aucune écriture). Ajouter --apply pour écrire.\n");
  await syncHome();
  await syncPages();
  await syncChrome();
  await syncWording();
  console.log(
    APPLY
      ? "\nTerminé. Purger le cache : POST /api/cron/revalidate-content (Bearer CRON_SECRET)."
      : "\nSimulation terminée.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
