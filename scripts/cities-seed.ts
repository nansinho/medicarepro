/**
 * Prépare les villes des pages SEO locales, par vagues (paliers) :
 *   vague 1 : villes déjà en base (préfectures et grandes villes, seed.sql) ;
 *   vague 2 : communes de 10 000 habitants et plus ;
 *   vague 3 : autres communes où exerce au moins un pédicure-podologue.
 *
 * Pour chaque ville : code INSEE, population, coordonnées, données locales
 * sourcées (local_data) et villes voisines (city_nearby), choisies parmi les
 * vagues déjà ouvertes : une ville de vague 1 ne renvoie que vers la vague 1,
 * pour que ses liens mènent à des pages publiées.
 *
 * Ne modifie jamais le contenu, le statut ni l'adresse (slug) d'une ville
 * déjà en base. Homonymes : la plus peuplée garde l'adresse simple, les
 * autres prennent le numéro de département (« valence-82 »).
 *
 * Sources : scripts/data/podologues-rpps.json (cf. cities-rpps-refresh.ts)
 * et geo.api.gouv.fr (population municipale INSEE).
 *
 * Usage (depuis la racine du repo) :
 *   npx tsx --env-file=.env.local scripts/cities-seed.ts           → simulation
 *   npx tsx --env-file=.env.local scripts/cities-seed.ts --apply   → écriture
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { densite, type CityLocalData } from "../src/lib/cms/city-data";

const APPLY = process.argv.includes("--apply");
const WAVE2_MIN_POPULATION = 10_000;
const NEARBY_COUNT = 6;
/** Au-delà, une ville n'est plus « voisine » (vague 1 clairsemée). */
const NEARBY_MAX_KM = 60;
const CHUNK = 500;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

type Rpps = {
  extraction: string;
  france: { total: number; liberaux: number };
  departements: Record<string, { total: number; liberaux: number }>;
  communes: Record<string, { total: number; liberaux: number }>;
};

type Commune = {
  nom: string;
  code: string;
  codesPostaux: string[];
  population?: number;
  centre?: { coordinates: [number, number] };
  departement: { code: string; nom: string };
  region: { code: string; nom: string };
};

type CityRow = {
  id: string;
  slug: string;
  name: string;
  name_locative: string;
  dept_code: string;
  dept_name: string;
  region: string;
  wave: number;
  status: string;
  insee_code: string | null;
};

/* ------------------------------------------------------------------ */

export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** « à Lyon », « au Havre », « aux Abymes », « à La Rochelle », « à L'Isle-Adam ». */
export function locative(name: string): string {
  if (name.startsWith("Le ")) return `au ${name.slice(3)}`;
  if (name.startsWith("Les ")) return `aux ${name.slice(4)}`;
  return `à ${name}`;
}

/** Territoire pour le voisinage : la Corse et chaque outre-mer forment le leur. */
const ISLAND_REGIONS = new Set(["94", "01", "02", "03", "04", "06"]);
function territoryOf(c: Commune): string {
  return ISLAND_REGIONS.has(c.region.code) ? c.region.code : "continent";
}

const fold = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function km(a: [number, number], b: [number, number]): number {
  const rad = Math.PI / 180;
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const h =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

async function fetchAllCities(): Promise<CityRow[]> {
  const rows: CityRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("cities")
      .select("id, slug, name, name_locative, dept_code, dept_name, region, wave, status, insee_code")
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data as CityRow[]));
    if (!data || data.length < 1000) return rows;
  }
}

async function inChunks<T>(items: T[], run: (chunk: T[]) => Promise<void>) {
  for (let i = 0; i < items.length; i += CHUNK) await run(items.slice(i, i + CHUNK));
}

/* ------------------------------------------------------------------ */

async function main() {
  console.log(APPLY ? "Écriture en base…\n" : "Simulation (aucune écriture). Ajouter --apply pour écrire.\n");

  const rpps = JSON.parse(fs.readFileSync("scripts/data/podologues-rpps.json", "utf8")) as Rpps;
  const communes = (await (
    await fetch("https://geo.api.gouv.fr/communes?fields=nom,code,codesPostaux,population,centre,departement,region&format=json")
  ).json()) as Commune[];
  const byCode = new Map(communes.map((c) => [c.code, c]));
  console.log(`${communes.length} communes (geo.api.gouv.fr) · Annuaire Santé du ${rpps.extraction}`);

  /* Populations départementales et nationale (somme des communes). */
  const deptPop = new Map<string, number>();
  let francePop = 0;
  for (const c of communes) {
    const p = c.population ?? 0;
    deptPop.set(c.departement.code, (deptPop.get(c.departement.code) ?? 0) + p);
    francePop += p;
  }

  /* Villes déjà en base : rapprochement par code INSEE, sinon nom + département. */
  const existing = await fetchAllCities();
  const byNameDept = new Map(communes.map((c) => [`${fold(c.nom)}|${c.departement.code}`, c]));
  const unmatched: string[] = [];
  const existingByCode = new Map<string, CityRow>();
  for (const row of existing) {
    const c = row.insee_code ? byCode.get(row.insee_code) : byNameDept.get(`${fold(row.name)}|${row.dept_code}`);
    if (c) existingByCode.set(c.code, row);
    else unmatched.push(`${row.name} (${row.dept_code})`);
  }

  /* Vagues. La liste d'origine (scripts/data/cities-fr.csv, 102 villes) forme
     la vague 1 ; les autres villes déjà en base gardent la leur. */
  const firstWave = new Set(
    fs.readFileSync("scripts/data/cities-fr.csv", "utf8").split(/\r?\n/).slice(1).map((l) => l.split(",")[0]).filter(Boolean),
  );
  const waveOf = new Map<string, number>();
  for (const [code, row] of existingByCode) waveOf.set(code, firstWave.has(row.slug) ? 1 : row.wave);
  for (const c of communes) {
    if (waveOf.has(c.code)) continue;
    if ((c.population ?? 0) >= WAVE2_MIN_POPULATION) waveOf.set(c.code, 2);
    else if ((rpps.communes[c.code]?.total ?? 0) >= 1) waveOf.set(c.code, 3);
  }

  /* Adresses : les existantes ne bougent pas ; homonymes départagés. */
  const slugOf = new Map<string, string>();
  const taken = new Set(existing.map((r) => r.slug));
  for (const [code, row] of existingByCode) slugOf.set(code, row.slug);
  const fresh = [...waveOf.keys()]
    .filter((code) => !existingByCode.has(code))
    .map((code) => byCode.get(code)!)
    .sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
  for (const c of fresh) {
    const base = slugify(c.nom);
    let slug = base;
    if (taken.has(slug)) slug = `${base}-${c.departement.code.toLowerCase()}`;
    if (taken.has(slug)) slug = `${base}-${c.code}`;
    taken.add(slug);
    slugOf.set(c.code, slug);
  }

  /* Homonymes parmi les villes qui ont une page : titre et H1 précisent le
     département (« Saint-Denis (93) » / « Saint-Denis (974) »). */
  const nameCount = new Map<string, number>();
  for (const code of waveOf.keys()) {
    const nom = byCode.get(code)!.nom;
    nameCount.set(nom, (nameCount.get(nom) ?? 0) + 1);
  }

  /* Données locales. */
  const franceDensite = densite(rpps.france.total, francePop) ?? 0;
  const localData = (c: Commune): CityLocalData => {
    const pod = rpps.communes[c.code] ?? { total: 0, liberaux: 0 };
    const dPod = rpps.departements[c.departement.code] ?? { total: 0, liberaux: 0 };
    const dPop = deptPop.get(c.departement.code) ?? 0;
    return {
      insee: c.code,
      population: c.population ?? 0,
      podologues: pod.total,
      podologuesLiberaux: pod.liberaux,
      densite: densite(pod.total, c.population ?? 0),
      departement: { code: c.departement.code, nom: c.departement.nom, podologues: dPod.total, population: dPop, densite: densite(dPod.total, dPop) ?? 0 },
      france: { podologues: rpps.france.total, population: francePop, densite: franceDensite },
      codesPostaux: c.codesPostaux,
      homonyme: (nameCount.get(c.nom) ?? 0) > 1,
      sources: { annuaireSante: rpps.extraction, population: "INSEE, population municipale (geo.api.gouv.fr)" },
    };
  };

  /* Bilan. */
  const counts = [1, 2, 3].map((w) => [...waveOf.values()].filter((v) => v === w).length);
  console.log(`Vague 1 : ${counts[0]} · vague 2 : ${counts[1]} · vague 3 : ${counts[2]} · total : ${waveOf.size}`);
  if (unmatched.length) console.log(`Villes en base non rapprochées (ignorées) : ${unmatched.join(", ")}`);
  const homonyms = fresh.filter((c) => slugOf.get(c.code) !== slugify(c.nom));
  console.log(`Villes homonymes (département précisé dans le titre) : ${[...nameCount.values()].filter((n) => n > 1).reduce((a, n) => a + n, 0)}`);
  console.log(`Homonymes départagés : ${homonyms.length} (ex. ${homonyms.slice(0, 5).map((c) => slugOf.get(c.code)).join(", ")})`);
  for (const code of ["75056", "65440", byNameDept.get("valence|26")?.code ?? ""]) {
    const c = byCode.get(code);
    if (c) console.log(`  ${c.nom} → /${slugOf.get(code)} · vague ${waveOf.get(code)} · ${JSON.stringify(localData(c)).slice(0, 190)}…`);
  }

  /* Villes voisines : même territoire (continent, Corse, chaque outre-mer :
     jamais de voisine de l'autre côté de la mer), à moins de NEARBY_MAX_KM,
     d'abord parmi les vagues déjà ouvertes (≤ la sienne, donc publiées
     avant elle), complétées au besoin par les communes les plus proches des
     vagues suivantes (affichées une fois publiées). */
  const all = [...waveOf.entries()].map(([code, wave]) => {
    const c = byCode.get(code)!;
    return { code, wave, pos: c.centre?.coordinates, territory: territoryOf(c) };
  });
  const nearest = (a: (typeof all)[number], accept: (b: (typeof all)[number]) => boolean, exclude: Set<string>) => {
    const best: { code: string; d: number }[] = [];
    for (const b of all) {
      if (b.code === a.code || !b.pos || b.territory !== a.territory || exclude.has(b.code) || !accept(b)) continue;
      const d = km(a.pos!, b.pos);
      if (best.length < NEARBY_COUNT || d < best[best.length - 1].d) {
        best.push({ code: b.code, d });
        best.sort((x, y) => x.d - y.d);
        if (best.length > NEARBY_COUNT) best.pop();
      }
    }
    return best;
  };
  const nearby = new Map<string, { code: string; d: number }[]>();
  for (const a of all) {
    if (!a.pos) continue;
    const open = nearest(a, (b) => b.wave <= a.wave, new Set()).filter((n) => n.d <= NEARBY_MAX_KM);
    const more = open.length < NEARBY_COUNT ? nearest(a, (b) => b.wave > a.wave, new Set(open.map((n) => n.code))) : [];
    nearby.set(a.code, [...open, ...more.slice(0, NEARBY_COUNT - open.length)]);
  }
  for (const code of ["65440", "2A004", "97411", "51454"]) {
    const list = nearby.get(code)?.map((n) => `${byCode.get(n.code)!.nom} (${Math.round(n.d)} km)`);
    console.log(`Voisines de ${byCode.get(code)?.nom} : ${list?.join(", ")}`);
  }

  if (!APPLY) {
    console.log("\nSimulation terminée.");
    return;
  }

  /* Écriture : villes existantes (sans toucher contenu/statut/slug), puis nouvelles. */
  const upsertExisting = [...existingByCode].map(([code, row]) => {
    const c = byCode.get(code)!;
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      name_locative: row.name_locative,
      dept_code: row.dept_code,
      dept_name: row.dept_name,
      region: row.region,
      wave: waveOf.get(code)!,
      insee_code: code,
      population: c.population ?? null,
      lat: c.centre?.coordinates[1] ?? null,
      lng: c.centre?.coordinates[0] ?? null,
      local_data: localData(c),
    };
  });
  await inChunks(upsertExisting, async (chunk) => {
    const { error } = await sb.from("cities").upsert(chunk, { onConflict: "id" });
    if (error) throw new Error(`Mise à jour des villes existantes : ${error.message}`);
  });

  const inserts = fresh.map((c) => ({
    slug: slugOf.get(c.code)!,
    name: c.nom,
    name_locative: locative(c.nom),
    dept_code: c.departement.code,
    dept_name: c.departement.nom,
    region: c.region.nom,
    population: c.population ?? null,
    lat: c.centre?.coordinates[1] ?? null,
    lng: c.centre?.coordinates[0] ?? null,
    wave: waveOf.get(c.code)!,
    status: "seeded",
    insee_code: c.code,
    local_data: localData(c),
  }));
  await inChunks(inserts, async (chunk) => {
    const { error } = await sb.from("cities").insert(chunk);
    if (error) throw new Error(`Ajout des nouvelles villes : ${error.message}`);
  });
  console.log(`✔ ${upsertExisting.length} villes mises à jour, ${inserts.length} ajoutées.`);

  /* Voisines : table recalculée entièrement. */
  const ids = new Map((await fetchAllCities()).filter((r) => r.insee_code).map((r) => [r.insee_code!, r.id]));
  const links = [...nearby].flatMap(([code, list]) =>
    list
      .filter((n) => ids.has(code) && ids.has(n.code))
      .map((n, position) => ({
        city_id: ids.get(code)!,
        nearby_city_id: ids.get(n.code)!,
        distance_km: Math.round(n.d * 10) / 10,
        position,
      })),
  );
  const { error: delError } = await sb.from("city_nearby").delete().not("city_id", "is", null);
  if (delError) throw new Error(`Purge des voisines : ${delError.message}`);
  await inChunks(links, async (chunk) => {
    const { error } = await sb.from("city_nearby").insert(chunk);
    if (error) throw new Error(`Voisines : ${error.message}`);
  });
  console.log(`✔ ${links.length} liens de villes voisines.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
