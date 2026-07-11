import "server-only";
import { createHash } from "node:crypto";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import { serviceClient } from "@/lib/supabase/service";

/* ============================================================
   Émission de facture (BILLING-1) — numérotation séquentielle via
   la RPC next_invoice_number(), PDF A4 généré avec pdf-lib
   (Helvetica standard, encodage WinAnsi), archivage dans le bucket
   privé 'billing' (invoices/<numéro>.pdf) + INSERT invoices.

   TVA : les prix sont affichés TTC (TVA 20 %) → HT = round(TTC/1,2),
   TVA = TTC − HT (la somme retombe toujours exactement sur le TTC).
   Mentions B2B obligatoires : TVA sur les encaissements, pénalités
   de retard (3× taux légal) + indemnité forfaitaire 40 €
   (art. L441-9 / D441-5 C. com.), « Escompte : néant ».
   ============================================================ */

export type InvoiceKind = "card_first" | "sdd_renewal";

export type IssueInvoiceInput = {
  kind: InvoiceKind;
  amountCents: number;
  currency: string;
  subscriptionId?: string;
  pendingSignupId?: string;
  cabinetName: string;
  cabinetAddress: string;
  cabinetPostalCity: string;
  planLabel: string;
  reference: string;
};

export type IssuedInvoice = {
  id: string;
  number: string;
  pdfBytes: Uint8Array;
};

/**
 * Décomposition TVA 20 % d'un montant TTC en centimes.
 * HT arrondi au centime le plus proche ; TVA = TTC − HT, si bien
 * que HT + TVA == TTC quel que soit l'arrondi.
 */
export function computeVatBreakdown(ttcCents: number): {
  htCents: number;
  vatCents: number;
  ttcCents: number;
} {
  const htCents = Math.round(ttcCents / 1.2);
  return { htCents, vatCents: ttcCents - htCents, ttcCents };
}

/* ------------------------------------------------------------
   Rendu PDF
   ------------------------------------------------------------ */

/* Palette du site (globals.css), convertie pour pdf-lib. */
const NAVY = rgb(39 / 255, 71 / 255, 96 / 255); // #274760
const BODY = rgb(93 / 255, 107 / 255, 123 / 255); // #5d6b7b
const MUTED = rgb(154 / 255, 168 / 255, 182 / 255); // #9aa8b6
const PRIMARY = rgb(43 / 255, 111 / 255, 214 / 255); // #2b6fd6
const LIGHT = rgb(234 / 255, 243 / 255, 252 / 255); // #eaf3fc
const RULE = rgb(217 / 255, 231 / 255, 246 / 255); // #d9e7f6
const WHITE = rgb(1, 1, 1);

/* Émetteur — mentions légales MEDICARE PRO. */
const COMPANY_NAME = "MEDICARE PRO";
const COMPANY_LINES = [
  "SAS au capital de 1 000 €",
  "340 chemin du plan marseillais",
  "13320 Bouc-Bel-Air",
  "SIRET 102 034 121 00016",
  "RCS Aix-en-Provence 102 034 121",
];

const KIND_LABELS: Record<InvoiceKind, string> = {
  card_first: "Règlement par carte bancaire",
  sdd_renewal: "Règlement par prélèvement SEPA",
};

/**
 * Rend une chaîne encodable en WinAnsi (Helvetica standard) :
 * espaces insécables/fines → espace simple, caractères hors
 * Latin-1/WinAnsi → « ? » (jamais d'exception au rendu).
 */
function winAnsiSafe(text: string): string {
  return (
    text
      // Espaces insécables / fines (produites par Intl fr-FR) → espace.
      .replace(/[    ]/g, " ")
      // ASCII imprimable + Latin-1 + caractères WinAnsi de 0x80-0x9F.
      .replace(
        /[^ -~¡-ÿ€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/g,
        "?",
      )
  );
}

/** "658,08 €" — affichage FR d'un montant en centimes (devise donnée). */
function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

type TextOptions = {
  x: number;
  y: number;
  size: number;
  font: PDFFont;
  color?: RGB;
};

function drawText(page: PDFPage, text: string, opts: TextOptions): void {
  page.drawText(winAnsiSafe(text), {
    x: opts.x,
    y: opts.y,
    size: opts.size,
    font: opts.font,
    color: opts.color ?? NAVY,
  });
}

/** Texte aligné à droite sur `right` (bord droit du bloc). */
function drawTextRight(
  page: PDFPage,
  text: string,
  right: number,
  opts: Omit<TextOptions, "x">,
): void {
  const safe = winAnsiSafe(text);
  const width = opts.font.widthOfTextAtSize(safe, opts.size);
  drawText(page, safe, { ...opts, x: right - width });
}

/** Construit le PDF A4 de la facture (une page). */
async function buildInvoicePdf(
  input: IssueInvoiceInput,
  number: string,
  issuedAtLabel: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Facture ${number} — ${COMPANY_NAME}`);
  doc.setAuthor(COMPANY_NAME);

  const page = doc.addPage([595.28, 841.89]); // A4 portrait
  const W = 595.28;
  const H = 841.89;
  const M = 50; // marge
  const RIGHT = W - M;

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const { htCents, vatCents, ttcCents } = computeVatBreakdown(
    input.amountCents,
  );
  const ht = formatCents(htCents, input.currency);
  const vat = formatCents(vatCents, input.currency);
  const ttc = formatCents(ttcCents, input.currency);

  /* --- Bandeau d'en-tête bleu --- */
  page.drawRectangle({ x: 0, y: H - 96, width: W, height: 96, color: PRIMARY });
  drawText(page, COMPANY_NAME, {
    x: M,
    y: H - 50,
    size: 18,
    font: bold,
    color: WHITE,
  });
  drawText(page, "medicarepro.fr", {
    x: M,
    y: H - 68,
    size: 9.5,
    font,
    color: WHITE,
  });
  drawTextRight(page, "FACTURE", RIGHT, {
    y: H - 44,
    size: 15,
    font: bold,
    color: WHITE,
  });
  drawTextRight(page, number, RIGHT, {
    y: H - 61,
    size: 10.5,
    font: bold,
    color: WHITE,
  });
  drawTextRight(page, `Émise le ${issuedAtLabel}`, RIGHT, {
    y: H - 76,
    size: 9,
    font,
    color: WHITE,
  });

  /* --- Blocs émetteur / client --- */
  const CLIENT_X = 330;
  let y = H - 96 - 36;
  drawText(page, "ÉMETTEUR", { x: M, y, size: 8, font: bold, color: MUTED });
  drawText(page, "FACTURÉ À", {
    x: CLIENT_X,
    y,
    size: 8,
    font: bold,
    color: MUTED,
  });
  y -= 16;
  drawText(page, COMPANY_NAME, { x: M, y, size: 10.5, font: bold });
  drawText(page, input.cabinetName, { x: CLIENT_X, y, size: 10.5, font: bold });
  let yCompany = y - 14;
  for (const line of COMPANY_LINES) {
    drawText(page, line, { x: M, y: yCompany, size: 9, font, color: BODY });
    yCompany -= 13;
  }
  let yClient = y - 14;
  for (const line of [input.cabinetAddress, input.cabinetPostalCity]) {
    drawText(page, line, {
      x: CLIENT_X,
      y: yClient,
      size: 9.5,
      font,
      color: BODY,
    });
    yClient -= 13;
  }

  /* --- Tableau de prestation --- */
  const COL_HT = 370;
  const COL_TVA = 455;
  const COL_TTC = RIGHT - 12;
  y = Math.min(yCompany, yClient) - 30;

  page.drawRectangle({
    x: M,
    y: y - 8,
    width: W - 2 * M,
    height: 26,
    color: LIGHT,
  });
  drawText(page, "DÉSIGNATION", {
    x: M + 12,
    y,
    size: 8.5,
    font: bold,
    color: MUTED,
  });
  drawTextRight(page, "MONTANT HT", COL_HT, {
    y,
    size: 8.5,
    font: bold,
    color: MUTED,
  });
  drawTextRight(page, "TVA (20 %)", COL_TVA, {
    y,
    size: 8.5,
    font: bold,
    color: MUTED,
  });
  drawTextRight(page, "MONTANT TTC", COL_TTC, {
    y,
    size: 8.5,
    font: bold,
    color: MUTED,
  });

  y -= 32;
  drawText(page, input.planLabel, { x: M + 12, y, size: 10, font: bold });
  drawTextRight(page, ht, COL_HT, { y, size: 10, font });
  drawTextRight(page, vat, COL_TVA, { y, size: 10, font });
  drawTextRight(page, ttc, COL_TTC, { y, size: 10, font: bold });
  y -= 14;
  drawText(page, `Abonnement MediCare Pro — ${KIND_LABELS[input.kind]}`, {
    x: M + 12,
    y,
    size: 8.5,
    font,
    color: BODY,
  });
  y -= 14;
  page.drawLine({
    start: { x: M, y },
    end: { x: RIGHT, y },
    thickness: 1,
    color: RULE,
  });

  /* --- Totaux (colonne de droite) --- */
  const LABEL_RIGHT = COL_TVA;
  y -= 26;
  drawTextRight(page, "Total HT", LABEL_RIGHT, {
    y,
    size: 10,
    font,
    color: BODY,
  });
  drawTextRight(page, ht, COL_TTC, { y, size: 10, font });
  y -= 18;
  drawTextRight(page, "TVA (20 %)", LABEL_RIGHT, {
    y,
    size: 10,
    font,
    color: BODY,
  });
  drawTextRight(page, vat, COL_TTC, { y, size: 10, font });
  y -= 28;
  page.drawRectangle({
    x: 300,
    y: y - 9,
    width: RIGHT - 300,
    height: 30,
    color: LIGHT,
  });
  drawTextRight(page, "TOTAL TTC", LABEL_RIGHT, { y, size: 11, font: bold });
  drawTextRight(page, ttc, COL_TTC, {
    y,
    size: 12,
    font: bold,
    color: PRIMARY,
  });

  /* --- Règlement --- */
  y -= 44;
  drawText(page, "Facture acquittée.", { x: M, y, size: 10, font: bold });
  y -= 15;
  drawText(
    page,
    `${KIND_LABELS[input.kind]} — référence de paiement : ${input.reference}`,
    { x: M, y, size: 9.5, font, color: BODY },
  );

  /* --- Mentions obligatoires (bas de page) --- */
  const mentions = [
    "TVA sur les encaissements. Escompte : néant.",
    "En cas de retard de paiement : pénalités exigibles au taux de trois fois le taux d'intérêt légal et indemnité",
    "forfaitaire pour frais de recouvrement de 40 € par facture (art. L441-9 et D441-5 du Code de commerce).",
  ];
  let yMentions = 110;
  for (const line of mentions) {
    drawText(page, line, { x: M, y: yMentions, size: 8, font, color: BODY });
    yMentions -= 12;
  }

  /* --- Pied de page --- */
  page.drawLine({
    start: { x: M, y: 62 },
    end: { x: RIGHT, y: 62 },
    thickness: 1,
    color: RULE,
  });
  const footer =
    "MEDICARE PRO — SAS au capital de 1 000 € — 340 chemin du plan marseillais, 13320 Bouc-Bel-Air — SIRET 102 034 121 00016 — RCS Aix-en-Provence 102 034 121";
  const footerSize = 7;
  const footerWidth = font.widthOfTextAtSize(winAnsiSafe(footer), footerSize);
  drawText(page, footer, {
    x: (W - footerWidth) / 2,
    y: 48,
    size: footerSize,
    font,
    color: MUTED,
  });

  return doc.save();
}

/* ------------------------------------------------------------
   Émission : numéro → PDF → sha256 → Storage → INSERT invoices.
   ------------------------------------------------------------ */

/**
 * Émet une facture : réserve un numéro séquentiel, génère le PDF,
 * l'archive dans le bucket privé 'billing' puis enregistre la ligne
 * dans `invoices`. Jette en cas d'indisponibilité (l'appelant gère).
 */
export async function issueInvoice(
  input: IssueInvoiceInput,
): Promise<IssuedInvoice> {
  const supabase = serviceClient();
  if (!supabase) {
    throw new Error(
      "Émission de facture impossible : client Supabase service non configuré.",
    );
  }

  const { data: numberData, error: numberError } = await supabase.rpc(
    "next_invoice_number",
  );
  if (numberError || typeof numberData !== "string" || numberData === "") {
    throw new Error(
      `Numérotation de facture indisponible${numberError ? ` : ${numberError.message}` : "."}`,
    );
  }
  const number = numberData;

  const issuedAtLabel = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const pdfBytes = await buildInvoicePdf(input, number, issuedAtLabel);
  const pdfSha256 = createHash("sha256").update(pdfBytes).digest("hex");
  const pdfPath = `invoices/${number}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from("billing")
    .upload(pdfPath, Buffer.from(pdfBytes), {
      contentType: "application/pdf",
    });
  if (uploadError) {
    throw new Error(
      `Échec de l'archivage du PDF de la facture ${number} : ${uploadError.message}`,
    );
  }

  const { data: inserted, error: insertError } = await supabase
    .from("invoices")
    .insert({
      number,
      kind: input.kind,
      amount_cents: input.amountCents,
      currency: input.currency,
      subscription_id: input.subscriptionId ?? null,
      pending_signup_id: input.pendingSignupId ?? null,
      pdf_path: pdfPath,
      pdf_sha256: pdfSha256,
      meta: { planLabel: input.planLabel, reference: input.reference },
    })
    .select("id")
    .single();
  if (insertError || !inserted) {
    throw new Error(
      `Échec de l'enregistrement de la facture ${number}${insertError ? ` : ${insertError.message}` : "."}`,
    );
  }

  return { id: inserted.id as string, number, pdfBytes };
}
