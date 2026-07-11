import "server-only";
import { createHash } from "node:crypto";

/* ============================================================
   Export des remises de prélèvements SEPA — génération EN MÉMOIRE
   (CSV de contrôle + pain.008.001.02 pour la banque).

   ⚠️ SÉCURITÉ : les lignes contiennent l'IBAN COMPLET, uniquement
   le temps de la génération. Ne JAMAIS journaliser une ligne ni
   persister le contenu en clair — seule l'empreinte sha256Hex(...)
   est archivée en base (sepa_remittances).
   Les messages d'erreur de ce module n'exposent jamais d'IBAN.
   ============================================================ */

export type RemittanceRow = {
  /** Référence Unique du Mandat. */
  rum: string;
  debtorName: string;
  /** IBAN complet — en mémoire seulement, jamais loggé ni stocké en clair. */
  iban: string;
  bic?: string;
  amountCents: number;
  /** Identifiant de bout en bout (EndToEndId, ≤ 35 caractères). */
  endToEndId: string;
  /** Date d'échéance du prélèvement, AAAA-MM-JJ. */
  dueDate: string;
  /** Séquence SEPA : FRST | RCUR | OOFF | FNAL. */
  sequenceType: string;
  /** Date de signature du mandat (AAAA-MM-JJ) — requise pour le pain.008 (DtOfSgntr). */
  signedAt?: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SEQUENCE_TYPES = new Set(["FRST", "RCUR", "OOFF", "FNAL"]);

/** Empreinte SHA-256 (hex) d'un export — à archiver à la place du contenu. */
export function sha256Hex(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/** Montant en euros « 298.08 » à partir de centimes (arithmétique entière). */
function euros(amountCents: number): string {
  const sign = amountCents < 0 ? "-" : "";
  const abs = Math.abs(amountCents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Somme des montants d'un lot, formatée en euros. */
function eurosSum(rows: RemittanceRow[]): string {
  return euros(rows.reduce((sum, row) => sum + row.amountCents, 0));
}

/** Garde-fous communs — les erreurs citent la RUM, JAMAIS l'IBAN. */
function assertRow(row: RemittanceRow, index: number): void {
  const where = `remise, ligne ${index + 1} (RUM ${row.rum || "?"})`;
  if (!row.rum) throw new Error(`${where} : RUM manquante.`);
  if (!row.iban) throw new Error(`${where} : IBAN manquant.`);
  if (!Number.isInteger(row.amountCents) || row.amountCents <= 0) {
    throw new Error(`${where} : montant invalide (centimes entiers > 0 attendus).`);
  }
  if (!row.endToEndId || row.endToEndId.length > 35) {
    throw new Error(`${where} : EndToEndId requis (35 caractères max).`);
  }
  if (!ISO_DATE.test(row.dueDate)) {
    throw new Error(`${where} : dueDate au format AAAA-MM-JJ attendue.`);
  }
  if (!SEQUENCE_TYPES.has(row.sequenceType)) {
    throw new Error(`${where} : sequenceType invalide (FRST|RCUR|OOFF|FNAL).`);
  }
}

/* ------------------------------------------------------------
   CSV de contrôle (relecture humaine avant envoi à la banque).
   Séparateur « ; » (Excel FR), décimales à point, CRLF.
   ------------------------------------------------------------ */

function csvField(value: string): string {
  return /[";\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Génère le CSV de la remise (en mémoire — ne pas persister en clair). */
export function buildRemittanceCsv(rows: RemittanceRow[]): string {
  rows.forEach(assertRow);
  const header = [
    "RUM",
    "Debiteur",
    "IBAN",
    "BIC",
    "Montant (EUR)",
    "EndToEndId",
    "Echeance",
    "Sequence",
  ];
  const lines = rows.map((row) =>
    [
      row.rum,
      row.debtorName,
      row.iban,
      row.bic ?? "",
      euros(row.amountCents),
      row.endToEndId,
      row.dueDate,
      row.sequenceType,
    ]
      .map(csvField)
      .join(";"),
  );
  return [header.join(";"), ...lines].join("\r\n") + "\r\n";
}

/* ------------------------------------------------------------
   pain.008.001.02 — ordre de prélèvement SEPA Core minimal.
   Un bloc PmtInf par sequenceType (exigence CORE), la date de
   règlement demandée (ReqdColltnDt) est commune à la remise.
   ------------------------------------------------------------ */

export type Pain008Input = {
  creditorName: string;
  /** Identifiant Créancier SEPA — billingEnv().sepaIcs. */
  ics: string;
  creditorIban: string;
  creditorBic: string;
  /** Date de règlement demandée (jour ouvré TARGET), AAAA-MM-JJ. */
  requestedCollectionDate: string;
  rows: RemittanceRow[];
  /** Identifiant de message (≤ 35 car.) — défaut : dérivé de `now`. */
  msgId?: string;
  /** Horodatage de génération (défaut : maintenant) — injectable en test. */
  now?: Date;
};

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Noms au jeu de caractères SEPA (latin non accentué) : les accents
 * sont translittérés, le reste remplacé par un espace, 70 car. max.
 */
function sepaName(value: string): string {
  const ascii = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const filtered = ascii
    .replace(/[^A-Za-z0-9/\-?:().,'+ ]/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
  return filtered.slice(0, 70) || "NON RENSEIGNE";
}

/** AAAAMMJJ-HHMMSS local, pour l'identifiant de message par défaut. */
function compactStamp(now: Date): string {
  const iso = now.toISOString(); // 2026-07-11T12:34:56.789Z
  return `${iso.slice(0, 10).replace(/-/g, "")}-${iso.slice(11, 19).replace(/:/g, "")}`;
}

/** Génère le XML pain.008.001.02 de la remise (en mémoire uniquement). */
export function buildPain008Xml(d: Pain008Input): string {
  if (d.rows.length === 0) {
    throw new Error("pain.008 : remise vide, aucune ligne à présenter.");
  }
  if (!ISO_DATE.test(d.requestedCollectionDate)) {
    throw new Error("pain.008 : requestedCollectionDate au format AAAA-MM-JJ attendue.");
  }
  d.rows.forEach((row, index) => {
    assertRow(row, index);
    // Le rulebook exige la date de signature du mandat (DtOfSgntr) :
    // mieux vaut échouer ici qu'un rejet de remise par la banque.
    if (!row.signedAt || !ISO_DATE.test(row.signedAt)) {
      throw new Error(
        `pain.008, ligne ${index + 1} (RUM ${row.rum}) : signedAt (date de ` +
          "signature du mandat, AAAA-MM-JJ) requis pour DtOfSgntr.",
      );
    }
  });

  const now = d.now ?? new Date();
  const msgId = (d.msgId ?? `MP-REM-${compactStamp(now)}`).slice(0, 35);
  const creDtTm = now.toISOString().slice(0, 19);
  const creditorName = xmlEscape(sepaName(d.creditorName));
  const ics = xmlEscape(d.ics);

  // Un PmtInf par type de séquence, dans un ordre stable (FRST avant RCUR…).
  const bySequence = new Map<string, RemittanceRow[]>();
  for (const sequence of ["FRST", "RCUR", "OOFF", "FNAL"]) {
    const batch = d.rows.filter((row) => row.sequenceType === sequence);
    if (batch.length > 0) bySequence.set(sequence, batch);
  }

  const pmtInfBlocks = [...bySequence.entries()].map(([sequence, batch]) => {
    const transactions = batch.map((row) => {
      const debtorAgent = row.bic
        ? `<FinInstnId><BIC>${xmlEscape(row.bic)}</BIC></FinInstnId>`
        : "<FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId>";
      return `        <DrctDbtTxInf>
          <PmtId><EndToEndId>${xmlEscape(row.endToEndId)}</EndToEndId></PmtId>
          <InstdAmt Ccy="EUR">${euros(row.amountCents)}</InstdAmt>
          <DrctDbtTx>
            <MndtRltdInf>
              <MndtId>${xmlEscape(row.rum)}</MndtId>
              <DtOfSgntr>${row.signedAt}</DtOfSgntr>
            </MndtRltdInf>
          </DrctDbtTx>
          <DbtrAgt>${debtorAgent}</DbtrAgt>
          <Dbtr><Nm>${xmlEscape(sepaName(row.debtorName))}</Nm></Dbtr>
          <DbtrAcct><Id><IBAN>${xmlEscape(row.iban)}</IBAN></Id></DbtrAcct>
        </DrctDbtTxInf>`;
    });

    return `    <PmtInf>
      <PmtInfId>${xmlEscape(`${msgId}-${sequence}`.slice(0, 35))}</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <NbOfTxs>${batch.length}</NbOfTxs>
      <CtrlSum>${eurosSum(batch)}</CtrlSum>
      <PmtTpInf>
        <SvcLvl><Cd>SEPA</Cd></SvcLvl>
        <LclInstrm><Cd>CORE</Cd></LclInstrm>
        <SeqTp>${sequence}</SeqTp>
      </PmtTpInf>
      <ReqdColltnDt>${d.requestedCollectionDate}</ReqdColltnDt>
      <Cdtr><Nm>${creditorName}</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>${xmlEscape(d.creditorIban)}</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BIC>${xmlEscape(d.creditorBic)}</BIC></FinInstnId></CdtrAgt>
      <ChrgBr>SLEV</ChrgBr>
      <CdtrSchmeId>
        <Id><PrvtId><Othr>
          <Id>${ics}</Id>
          <SchmeNm><Prtry>SEPA</Prtry></SchmeNm>
        </Othr></PrvtId></Id>
      </CdtrSchmeId>
${transactions.join("\n")}
    </PmtInf>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${xmlEscape(msgId)}</MsgId>
      <CreDtTm>${creDtTm}</CreDtTm>
      <NbOfTxs>${d.rows.length}</NbOfTxs>
      <CtrlSum>${eurosSum(d.rows)}</CtrlSum>
      <InitgPty><Nm>${creditorName}</Nm></InitgPty>
    </GrpHdr>
${pmtInfBlocks.join("\n")}
  </CstmrDrctDbtInitn>
</Document>
`;
}
