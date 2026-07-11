import "server-only";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type Color,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { CREDITOR, creditorPostalAddress } from "@/lib/sepa/creditor";

/* ============================================================
   Rendu PDF du mandat de prélèvement SEPA (archive probante,
   bucket Storage privé « sepa »).

   Le texte qui fait foi est d.mandateText (son SHA-256 est
   archivé en base) : le PDF le restitue INTÉGRALEMENT, encadré
   d'un en-tête MEDICARE PRO et d'un bloc de signature
   électronique — JAMAIS de zone de signature vide.

   Polices : StandardFonts.Helvetica (encodage WinAnsi). Les
   accents français (é è à ç…) et la puce « • » sont couverts ;
   tout caractère hors WinAnsi est remplacé par « * » en amont.

   ⚠️ IBAN : ce PDF ne reçoit que l'IBAN MASQUÉ (ibanMasked).
   ============================================================ */

export type MandatePdfData = {
  rum: string;
  ics: string;
  scheme: "CORE";
  debtorName: string;
  accountHolder: string;
  debtorAddress: string;
  debtorEmail: string;
  /** IBAN masqué (maskIban) — jamais l'IBAN complet. */
  ibanMasked: string;
  /** Date de signature déjà formatée, ex. « 11 juillet 2026 à 14 h 05 ». */
  signedAtLabel: string;
  signatureIp: string;
  /** Ex. « case cochée lors de la souscription ». */
  signatureMethod: string;
  /** Texte intégral du mandat (mandateText de @/lib/sepa/mandate-text). */
  mandateText: string;
};

/* ---------- Mise en page (A4, points PDF) ---------- */
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 56;
const MARGIN_TOP = 56;
const MARGIN_BOTTOM = 70;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

const COLOR_BRAND = rgb(37 / 255, 99 / 255, 235 / 255); // bleu du thème
const COLOR_TEXT = rgb(0.13, 0.17, 0.23);
const COLOR_MUTED = rgb(0.42, 0.45, 0.5);
const COLOR_BOX = rgb(0.937, 0.961, 1);
const COLOR_RULE = rgb(0.85, 0.88, 0.92);

/* ---------- Nettoyage WinAnsi ---------- */

/** Caractères Windows-1252 (0x80-0x9F) acceptés par Helvetica/WinAnsi. */
const WINANSI_EXTRA = new Set(
  "€‚ƒ„…†‡ˆ‰Š‹ŒŽ" +
    "‘’“”•–—˜™š›œžŸ",
);

/** Remplace tout caractère hors WinAnsi (« * ») pour ne jamais faire échouer le rendu. */
function toWinAnsi(text: string): string {
  let out = "";
  for (const ch of text.normalize("NFC")) {
    const code = ch.codePointAt(0) ?? 0;
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)) out += ch;
    else if (WINANSI_EXTRA.has(ch)) out += ch;
    else if (ch === " " || ch === " ") out += " "; // espaces fines → insécable
    else if (ch === "‑") out += "-"; // trait d'union insécable
    else out += "*";
  }
  return out;
}

/** Ligne de section du mandat (« CRÉANCIER », « DÉBITEUR »…) ? */
function isSectionHeading(line: string): boolean {
  return (
    line.length <= 48 &&
    !line.includes(":") &&
    /[A-ZÀÂÄÇÉÈÊËÎÏÔÖÙÛÜÆŒ]/.test(line) &&
    line === line.toUpperCase()
  );
}

/**
 * Construit le PDF A4 du mandat signé électroniquement.
 * @returns les octets du PDF (à uploader dans le bucket « sepa »).
 */
export async function buildMandatePdf(d: MandatePdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Mandat de prélèvement SEPA — RUM ${d.rum}`);
  doc.setAuthor(CREDITOR.name);
  doc.setSubject(`Mandat SEPA ${d.scheme} — ${d.debtorName}`);
  doc.setLanguage("fr-FR");

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN_TOP;

  /** Nouvelle page si la hauteur demandée ne tient plus. */
  function ensureRoom(height: number): void {
    if (y - height < MARGIN_BOTTOM) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN_TOP;
    }
  }

  /** Coupe un texte en lignes tenant dans `maxWidth` (par mots). */
  function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const clean = toWinAnsi(text);
    if (!clean.trim()) return [];
    const words = clean.split(/ +/);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (!current || font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  type ParagraphOptions = {
    font?: PDFFont;
    size?: number;
    color?: Color;
    gapAfter?: number;
    centered?: boolean;
  };

  /** Dessine un paragraphe (avec césure et saut de page automatiques). */
  function drawParagraph(text: string, options: ParagraphOptions = {}): void {
    const font = options.font ?? regular;
    const size = options.size ?? 9.5;
    const color = options.color ?? COLOR_TEXT;
    const lineHeight = size * 1.45;
    for (const line of wrap(text, font, size, CONTENT_WIDTH)) {
      ensureRoom(lineHeight);
      const x = options.centered
        ? MARGIN_X + (CONTENT_WIDTH - font.widthOfTextAtSize(line, size)) / 2
        : MARGIN_X;
      page.drawText(line, { x, y: y - size, size, font, color });
      y -= lineHeight;
    }
    y -= options.gapAfter ?? 0;
  }

  type BoxRow = { text: string; font?: PDFFont; size?: number; color?: Color };

  /** Dessine un encadré à fond clair contenant plusieurs lignes. */
  function drawBox(rows: BoxRow[], gapAfter = 14): void {
    const padding = 12;
    const innerWidth = CONTENT_WIDTH - padding * 2;
    const wrapped = rows.flatMap((row) => {
      const font = row.font ?? regular;
      const size = row.size ?? 9.5;
      const color = row.color ?? COLOR_TEXT;
      return wrap(row.text, font, size, innerWidth).map((line) => ({ line, font, size, color }));
    });
    const height = padding * 2 + wrapped.reduce((sum, row) => sum + row.size * 1.5, 0);
    ensureRoom(height);
    page.drawRectangle({
      x: MARGIN_X,
      y: y - height,
      width: CONTENT_WIDTH,
      height,
      color: COLOR_BOX,
      borderColor: COLOR_RULE,
      borderWidth: 0.75,
    });
    let slotTop = y - padding;
    for (const row of wrapped) {
      page.drawText(row.line, {
        x: MARGIN_X + padding,
        y: slotTop - row.size,
        size: row.size,
        font: row.font,
        color: row.color,
      });
      slotTop -= row.size * 1.5;
    }
    y -= height + gapAfter;
  }

  /* ---------- En-tête MEDICARE PRO ---------- */
  drawParagraph(CREDITOR.name, { font: bold, size: 13, color: COLOR_BRAND, gapAfter: 1 });
  drawParagraph(
    `${CREDITOR.legalForm} — ${creditorPostalAddress()} — SIRET ${CREDITOR.siret} — ${CREDITOR.rcs}`,
    { size: 7.5, color: COLOR_MUTED, gapAfter: 8 },
  );
  page.drawLine({
    start: { x: MARGIN_X, y },
    end: { x: PAGE_WIDTH - MARGIN_X, y },
    thickness: 1,
    color: COLOR_RULE,
  });
  y -= 22;

  /* ---------- Titre ---------- */
  drawParagraph("Mandat de Prélèvement SEPA", {
    font: bold,
    size: 16,
    centered: true,
    gapAfter: 2,
  });
  drawParagraph(`Schéma ${d.scheme} — Prélèvement récurrent`, {
    size: 9.5,
    color: COLOR_MUTED,
    centered: true,
    gapAfter: 12,
  });

  /* ---------- Références du mandat ---------- */
  drawBox([
    { text: `Référence Unique du Mandat (RUM) : ${d.rum}`, font: bold, size: 10 },
    { text: `Identifiant Créancier SEPA (ICS) : ${d.ics}`, font: bold, size: 10 },
  ]);

  /* ---------- Texte intégral du mandat ---------- */
  const lines = d.mandateText.split("\n");
  // Le titre du texte est déjà rendu en tête de page : on ne le répète pas.
  const start = lines[0]?.trim() === "Mandat de Prélèvement SEPA" ? 1 : 0;
  for (const raw of lines.slice(start)) {
    const line = raw.trim();
    if (!line) {
      y -= 5;
      continue;
    }
    if (isSectionHeading(line)) {
      y -= 4;
      drawParagraph(line, { font: bold, size: 10.5, gapAfter: 3 });
    } else {
      drawParagraph(line, { size: 9.5, gapAfter: 2.5 });
    }
  }
  y -= 10;

  /* ---------- Signature électronique (jamais de zone vide) ---------- */
  drawBox(
    [
      { text: "SIGNATURE ÉLECTRONIQUE", font: bold, size: 10 },
      {
        text:
          `Signé électroniquement le ${d.signedAtLabel} par ${d.debtorName} ` +
          `(IP ${d.signatureIp}, méthode : ${d.signatureMethod}).`,
        size: 9.5,
      },
      { text: `Email du signataire : ${d.debtorEmail}`, size: 9.5 },
      {
        text:
          "Ce document a été signé électroniquement lors de la souscription " +
          "en ligne : il vaut mandat signé, aucune signature manuscrite " +
          "n'est requise.",
        size: 8,
        color: COLOR_MUTED,
      },
    ],
    0,
  );

  /* ---------- Pied de page (toutes les pages) ---------- */
  const pages = doc.getPages();
  pages.forEach((current, index) => {
    const label = toWinAnsi(
      `${CREDITOR.name} — Mandat de prélèvement SEPA — RUM ${d.rum} — page ${index + 1}/${pages.length}`,
    );
    const width = regular.widthOfTextAtSize(label, 7.5);
    current.drawText(label, {
      x: (PAGE_WIDTH - width) / 2,
      y: 32,
      size: 7.5,
      font: regular,
      color: COLOR_MUTED,
    });
  });

  return doc.save();
}
