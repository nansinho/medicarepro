/**
 * Détourage local d'une image (suppression du fond) + post-traitement sharp.
 *
 * Usage : node scripts/remove-bg.mjs <entrée> <sortie.png> [--dehalo]
 *   ex.  node scripts/remove-bg.mjs "public/images/photo.jpeg" public/images/hero-duo.png
 *
 * --dehalo : étire les niveaux alpha ([20..235] → [0..255]) pour supprimer un
 *            liseré résiduel. À n'activer que si un halo est visible : le
 *            traitement grignote aussi les cheveux fins.
 *
 * Tout s'exécute en local (modèle ISNet embarqué dans le paquet npm),
 * l'image ne quitte jamais la machine.
 *
 * Prérequis (désinstallé après usage car ~200 Mo) :
 *   npm i -D @imgly/background-removal-node
 *
 * Architecture en 2 processus (--stage cut | post, chaînés automatiquement) :
 * @imgly/background-removal-node embarque un vieux sharp dont la libvips
 * entre en conflit de DLL avec le sharp du projet si les deux sont chargés
 * dans le même processus Windows.
 */
import { spawnSync } from "node:child_process";
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const argv = process.argv.slice(2);
const dehalo = argv.includes("--dehalo");
const stageIdx = argv.indexOf("--stage");
const stage = stageIdx !== -1 ? argv[stageIdx + 1] : null;
const positional = argv.filter(
  (a, i) => a !== "--dehalo" && a !== "--stage" && (stageIdx === -1 || i !== stageIdx + 1),
);
const src = positional[0] ?? "public/images/hero-duo-source.png";
const dest = positional[1] ?? "public/images/hero-duo.png";

/* ---------- étape 1 : détourage (processus dédié à imgly) ---------- */
async function cut() {
  const { removeBackground } = await import("@imgly/background-removal-node");
  const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };
  const type = MIME[path.extname(src).toLowerCase()];
  if (!type) throw new Error(`Format non géré : ${src}`);

  console.log(`Détourage de ${src}…`);
  const input = new Blob([await readFile(src)], { type });
  const blob = await removeBackground(input, {
    model: "medium", // ISNet fp16 — le plus gros modèle embarqué dans le paquet (« large » n'est pas livré)
    output: { format: "image/png", quality: 1 },
  });
  const { writeFile } = await import("node:fs/promises");
  await writeFile(dest, Buffer.from(await blob.arrayBuffer()));
}

/* ---------- étape 2 : post-traitement (processus dédié à sharp) ---------- */
async function post() {
  const sharp = (await import("sharp")).default;

  // 1) Trim des bords transparents (référence : pixel haut-gauche, transparent après détourage)
  let img = sharp(await sharp(src).trim({ threshold: 10 }).png().toBuffer());

  // 2) Dé-halo opt-in : suppression des franges alpha faibles
  if (dehalo) {
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    const alpha = await sharp(data, { raw: info })
      .extractChannel("alpha")
      .linear(255 / (235 - 20), (-20 * 255) / (235 - 20))
      .toBuffer();
    img = sharp(data, { raw: info })
      .removeAlpha()
      .joinChannel(alpha, { raw: { width: info.width, height: info.height, channels: 1 } });
  }

  // 3) Plafond de taille — jamais d'upscale (un matte agrandi se dégrade)
  await img
    .resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(dest);

  const meta = await sharp(dest).metadata();
  const { size } = await (await import("node:fs/promises")).stat(dest);
  console.log(`OK → ${dest} (${meta.width}×${meta.height}, ${(size / 1024).toFixed(0)} Ko)`);
}

/* ---------- orchestration : se relance en 2 sous-processus ---------- */
if (stage === "cut") {
  await cut();
} else if (stage === "post") {
  await post();
} else {
  const self = fileURLToPath(import.meta.url);
  const raw = dest.replace(/\.png$/i, ".raw.png");
  const run = (args) => {
    const r = spawnSync(process.execPath, [self, ...args], { stdio: "inherit" });
    if (r.status !== 0) process.exit(r.status ?? 1);
  };
  run(["--stage", "cut", src, raw]);
  run(["--stage", "post", raw, dest, ...(dehalo ? ["--dehalo"] : [])]);
  await unlink(raw);
}
