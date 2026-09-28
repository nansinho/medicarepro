/**
 * Compte les pédicures-podologues par commune, département et pour la
 * France, depuis l'extraction en libre accès de l'Annuaire Santé (RPPS,
 * Agence du Numérique en Santé, Licence Ouverte) publiée sur data.gouv.fr.
 *
 * Usage (depuis la racine du repo) :
 *   npx tsx scripts/cities-rpps-refresh.ts                 → télécharge la dernière extraction
 *   npx tsx scripts/cities-rpps-refresh.ts --file <chemin> → fichier déjà téléchargé
 *
 * Écrit scripts/data/podologues-rpps.json, lu par scripts/cities-seed.ts.
 * Un praticien est compté une fois par commune (et une fois par
 * département, une fois pour la France), même s'il exerce sur plusieurs
 * sites. Paris, Lyon et Marseille : arrondissements regroupés.
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { Readable } from "node:stream";

const DATASET =
  "https://www.data.gouv.fr/api/1/datasets/annuaire-sante-extractions-des-donnees-en-libre-acces-des-professionnels-intervenant-dans-le-systeme-de-sante-rpps/";
const RESOURCE_TITLE = "ps-libreacces-personne-activite.txt";
const PROFESSION = "Pédicure-Podologue";
const OUT = path.resolve("scripts/data/podologues-rpps.json");

/* Colonnes de l'extraction (en-tête « Identifiant PP|…|Code commune (coord. structure)|… »). */
const COL = { pp: "Identifiant PP", profession: "Libellé profession", mode: "Code mode exercice", commune: "Code commune (coord. structure)" };

/** Arrondissements municipaux → commune (Paris, Lyon, Marseille). */
export function communeOf(code: string): string {
  if (/^751(0[1-9]|1\d|20)$/.test(code)) return "75056";
  if (/^6938[1-9]$/.test(code)) return "69123";
  if (/^132(0[1-9]|1[0-6])$/.test(code)) return "13055";
  return code;
}

/** Département d'un code commune INSEE (2A/2B, outre-mer sur 3 chiffres). */
export function deptOf(code: string): string {
  return code.startsWith("97") ? code.slice(0, 3) : code.slice(0, 2);
}

type Counter = { all: Set<string>; lib: Set<string> };
const counter = (): Counter => ({ all: new Set(), lib: new Set() });

function count(c: Counter, pp: string, liberal: boolean) {
  c.all.add(pp);
  if (liberal) c.lib.add(pp);
}

function countIn(map: Map<string, Counter>, key: string, pp: string, liberal: boolean) {
  let c = map.get(key);
  if (!c) map.set(key, (c = counter()));
  count(c, pp, liberal);
}

async function source(): Promise<{ stream: NodeJS.ReadableStream; date: string }> {
  const i = process.argv.indexOf("--file");
  if (i > 0 && process.argv[i + 1]) {
    const file = process.argv[i + 1];
    const date = process.argv.includes("--date") ? process.argv[process.argv.indexOf("--date") + 1] : fs.statSync(file).mtime.toISOString().slice(0, 10);
    return { stream: fs.createReadStream(file, { encoding: "utf8" }), date };
  }
  const meta = (await (await fetch(DATASET)).json()) as { resources: { title: string; url: string; last_modified: string }[] };
  const res = meta.resources.find((r) => r.title === RESOURCE_TITLE);
  if (!res) throw new Error(`Ressource « ${RESOURCE_TITLE} » introuvable sur data.gouv.fr`);
  console.log(`Téléchargement de l'extraction du ${res.last_modified.slice(0, 10)}…`);
  const body = (await fetch(res.url)).body;
  if (!body) throw new Error("Téléchargement vide");
  return { stream: Readable.fromWeb(body as import("node:stream/web").ReadableStream), date: res.last_modified.slice(0, 10) };
}

async function main() {
  const { stream, date } = await source();
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  const communes = new Map<string, Counter>();
  const depts = new Map<string, Counter>();
  const france = counter();
  let idx: Record<keyof typeof COL, number> | null = null;
  let lines = 0;

  for await (const line of rl) {
    const f = line.split("|");
    if (!idx) {
      idx = Object.fromEntries(
        Object.entries(COL).map(([k, name]) => {
          const at = f.indexOf(name);
          if (at < 0) throw new Error(`Colonne « ${name} » absente de l'extraction`);
          return [k, at];
        }),
      ) as Record<keyof typeof COL, number>;
      continue;
    }
    lines++;
    if (f[idx.profession] !== PROFESSION) continue;
    const pp = f[idx.pp];
    const liberal = f[idx.mode] === "L";
    const code = f[idx.commune];
    count(france, pp, liberal);
    if (code) {
      countIn(communes, communeOf(code), pp, liberal);
      countIn(depts, deptOf(code), pp, liberal);
    }
  }

  const dump = (m: Map<string, Counter>) =>
    Object.fromEntries([...m].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, { total: v.all.size, liberaux: v.lib.size }]));
  const out = {
    source: "Annuaire Santé (RPPS), Agence du Numérique en Santé, Licence Ouverte",
    extraction: date,
    france: { total: france.all.size, liberaux: france.lib.size },
    departements: dump(depts),
    communes: dump(communes),
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(
    `${lines} lignes lues · ${out.france.total} podologues (${out.france.liberaux} libéraux) · ` +
      `${communes.size} communes · ${depts.size} départements → ${path.relative(process.cwd(), OUT)}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
