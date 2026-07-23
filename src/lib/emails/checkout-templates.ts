import "server-only";

/* ============================================================
   Templates email du tunnel d'inscription (BILLING-1) — MediCare Pro.
   Prolongement visuel de l'email de contact (contact-template.ts) :
   carte blanche 600 px à grand rayon (22px) + ombre bleutée, en-tête
   au dégradé des boutons avec le VRAI logo bouclier (ShieldPlus),
   récapitulatifs en encadrés sobres, badges HDS/RGPD du footer.
   HTML email-safe : tables + styles inline, largeur 600 px.
   Palette : miroir des tokens de src/app/globals.css.

   Chaque template renvoie { subject, text, html }. Les briques de
   mise en page (emailShell, kvCard, callout…) sont exportées pour
   être réutilisées par les templates SEPA (sepa-templates.ts).
   ============================================================ */

const NAVY = "#274760";
const NAVY_SOFT = "#1d3e5e";
const BODY = "#5d6b7b";
const PRIMARY = "#2b6fd6";
const LIGHT = "#eaf3fc"; // fond des encadrés / pastilles
const RULE = "#e6eef7";
const RULE_ON_LIGHT = "#d9e7f6"; // filets à l'intérieur des encadrés
const MUTED = "#9aa8b6";
const PAGE_BG = "#eef5fc"; // fond de page (hero pâle du site)
const CARD = "#ffffff";
const GRAD = "linear-gradient(100deg,#3a7fd9,#21487e)"; // dégradé des boutons

/* Pile système sans-serif (propre, pro, rendu natif dans les webmails). */
const SANS =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "'Courier New',Courier,monospace";

/** Un email prêt à passer à sendMail() : sujet + texte brut + HTML. */
export type EmailContent = { subject: string; text: string; html: string };

/** Échappe le HTML pour éviter toute injection dans le corps de l'email. */
export function escHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* Pictogramme officiel 2026 (croix + étoile), hébergé sur le site :
   les clients mail bloquent les data-URI mais chargent les images
   distantes — PNG net à 26 px, servi depuis medicarepro.fr. */
const LOGO = "https://medicarepro.fr/icon-192.png";

/** Valeur « technique » (référence, RUM, IBAN masqué) en chasse fixe. */
export function mono(value: string): string {
  return `<span style="font-family:${MONO};font-size:14px;letter-spacing:.02em;">${escHtml(value)}</span>`;
}

/** Note de bas de page des emails CLIENTS (reçu, mandat, incident…). */
export const CLIENT_FOOTER_NOTE = `Email automatique de <a href="https://medicarepro.fr" style="color:${MUTED};">medicarepro.fr</a>. Une question&nbsp;? Écrivez-nous à <a href="mailto:contact@medicarepro.fr" style="color:${PRIMARY};text-decoration:none;">contact@medicarepro.fr</a>.`;

/** Note de bas de page des alertes INTERNES (équipe billing). */
export const INTERNAL_FOOTER_NOTE = `Alerte interne du système de facturation de <a href="https://medicarepro.fr" style="color:${MUTED};">medicarepro.fr</a> — ne pas transférer hors de l'équipe.`;

/* ------------------------------------------------------------
   Briques de mise en page — chaque brique rend une ou plusieurs
   rangées <tr> de la carte principale (compat clients mail).
   ------------------------------------------------------------ */

/** Titre h1 + paragraphe d'introduction optionnel (introHtml = HTML). */
export function heading(title: string, introHtml?: string): string {
  const intro = introHtml
    ? `<p style="margin:10px 0 0;font-family:${SANS};font-size:14px;color:${BODY};line-height:1.7;">${introHtml}</p>`
    : "";
  return `
          <tr>
            <td style="padding:36px 40px 0;">
              <h1 style="margin:0;font-family:${SANS};font-size:23px;font-weight:700;color:${NAVY};line-height:1.3;">${escHtml(title)}</h1>
              ${intro}
            </td>
          </tr>`;
}

/** Paragraphe libre (HTML) sous un bloc. */
export function paragraph(html: string): string {
  return `
          <tr>
            <td style="padding:20px 40px 0;">
              <p style="margin:0;font-family:${SANS};font-size:14px;color:${BODY};line-height:1.7;">${html}</p>
            </td>
          </tr>`;
}

export type KvRow = { label: string; valueHtml: string };

/** Encadré récapitulatif : lignes libellé (petit gris) / valeur (navy). */
export function kvCard(rows: KvRow[]): string {
  const rowsHtml = rows
    .map((row, i) => {
      const rule =
        i === rows.length - 1
          ? ""
          : `border-bottom:1px solid ${RULE_ON_LIGHT};`;
      return `
                    <tr>
                      <td style="padding:12px 18px 12px 0;${rule}font-family:${SANS};font-size:11px;font-weight:700;color:${MUTED};letter-spacing:.05em;text-transform:uppercase;white-space:nowrap;vertical-align:middle;">${escHtml(row.label)}</td>
                      <td align="right" style="padding:12px 0;${rule}font-family:${SANS};font-size:15px;font-weight:600;color:${NAVY};line-height:1.5;vertical-align:middle;">${row.valueHtml}</td>
                    </tr>`;
    })
    .join("");
  return `
          <tr>
            <td style="padding:24px 40px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${LIGHT};border-radius:14px;">
                <tr><td style="padding:8px 24px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml}
                  </table>
                </td></tr>
              </table>
            </td>
          </tr>`;
}

/** Encadré sobre à filet d'accent bleu à gauche (contenu HTML). */
export function callout(html: string): string {
  return `
          <tr>
            <td style="padding:24px 40px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${LIGHT};border-radius:14px;">
                <tr>
                  <td style="width:4px;background:${PRIMARY};border-radius:14px 0 0 14px;"></td>
                  <td style="padding:18px 24px;font-family:${SANS};font-size:14px;color:${NAVY_SOFT};line-height:1.7;">${html}</td>
                </tr>
              </table>
            </td>
          </tr>`;
}

export type EmailShellOptions = {
  /** <title> du document. */
  title: string;
  /** Texte d'aperçu masqué (préheader), en clair — échappé ici. */
  preheader: string;
  /** Pastille de l'en-tête (« Paiement confirmé », « Alerte interne »…). */
  badge: string;
  /** Rangées <tr> du corps (heading, kvCard, callout, paragraph…). */
  bodyHtml: string;
  /** Note (HTML) sous les badges de confiance du pied de page. */
  footerNoteHtml: string;
};

/** Gabarit complet : fond de page, carte 600 px, en-tête dégradé, pied. */
export function emailShell(opts: EmailShellOptions): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:${PAGE_BG};-webkit-text-size-adjust:100%;">
  <!-- Préheader (masqué) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escHtml(opts.preheader)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE_BG};">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:${CARD};border-radius:22px;overflow:hidden;box-shadow:0 24px 60px rgba(31,84,153,.12);">

          <!-- En-tête : dégradé propre + vrai logo + pastille -->
          <tr>
            <td style="background:${GRAD};background-color:${PRIMARY};padding:30px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                      <td style="vertical-align:middle;padding-right:13px;">
                        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="width:42px;height:42px;background:rgba(255,255,255,.16);border-radius:12px;text-align:center;vertical-align:middle;">
                          <img src="${LOGO}" width="26" height="26" alt="" style="vertical-align:middle;background:#ffffff;border-radius:8px;padding:3px;">
                        </td></tr></table>
                      </td>
                      <td style="vertical-align:middle;font-family:${SANS};font-size:19px;font-weight:700;color:#ffffff;letter-spacing:-.01em;">MediCare&nbsp;Pro</td>
                    </tr></table>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="display:inline-block;background:rgba(255,255,255,.16);border-radius:999px;padding:7px 14px;font-family:${SANS};font-size:12px;font-weight:600;color:#ffffff;">${escHtml(opts.badge)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
${opts.bodyHtml}

          <!-- Pied : badges de confiance + note -->
          <tr>
            <td style="padding:32px 40px 34px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${RULE};">
                <tr><td style="padding-top:24px;">
                  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                    <td style="background:${LIGHT};border-radius:999px;padding:8px 15px;font-family:${SANS};font-size:11px;font-weight:700;color:${PRIMARY};">Hébergé en France · HDS</td>
                    <td style="width:8px;"></td>
                    <td style="background:${LIGHT};border-radius:999px;padding:8px 15px;font-family:${SANS};font-size:11px;font-weight:700;color:${PRIMARY};">RGPD · Chiffré</td>
                  </tr></table>
                  <p style="margin:18px 0 0;font-family:${SANS};font-size:11px;color:${MUTED};line-height:1.6;">${opts.footerNoteHtml}</p>
                </td></tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/* ============================================================
   1. Reçu de paiement (client) — après IPN « payé ».
   L'email de bienvenue AVEC le lien de connexion vient de l'APP :
   ici on remercie, on récapitule, on annonce la suite.
   ============================================================ */

export type PaymentReceiptData = {
  adminFirstName: string;
  cabinetName: string;
  planLabel: string;
  amountLabel: string;
  reference: string;
  paidAtLabel: string;
  invoiceNumber?: string;
  /**
   * Reconduction automatique par carte : montant et périodicité en clair,
   * rappelés par écrit après l'achat (obligation d'information sur un
   * abonnement à reconduction tacite). Absents = pas de reconduction
   * annoncée (renouvellement SEPA, étape mandat active).
   */
  renewal?: { amountLabel: string; periodLabel: string; nextDateLabel: string };
};

export function paymentReceiptEmail(d: PaymentReceiptData): EmailContent {
  const subject = "Votre paiement est confirmé — MediCare Pro";

  const rows: KvRow[] = [
    { label: "Cabinet", valueHtml: escHtml(d.cabinetName) },
    { label: "Formule", valueHtml: escHtml(d.planLabel) },
    { label: "Montant réglé TTC", valueHtml: escHtml(d.amountLabel) },
    { label: "Référence", valueHtml: mono(d.reference) },
    { label: "Date du paiement", valueHtml: escHtml(d.paidAtLabel) },
  ];
  if (d.invoiceNumber) {
    rows.push({ label: "Facture", valueHtml: escHtml(d.invoiceNumber) });
  }
  if (d.renewal) {
    rows.push({
      label: "Reconduction",
      valueHtml: `${escHtml(d.renewal.amountLabel)} TTC ${escHtml(d.renewal.periodLabel)}, le ${escHtml(d.renewal.nextDateLabel)}`,
    });
  }

  const renewalHtml = d.renewal
    ? callout(
        `<strong style="color:${NAVY};">Votre abonnement est à reconduction automatique.</strong> Il sera renouvelé ${escHtml(d.renewal.periodLabel)} pour ${escHtml(d.renewal.amountLabel)} TTC, sur la carte utilisée aujourd'hui, à partir du ${escHtml(d.renewal.nextDateLabel)}. Pour l'arrêter, écrivez-nous à <a href="mailto:contact@medicarepro.fr" style="color:${PRIMARY};text-decoration:none;">contact@medicarepro.fr</a>&nbsp;: votre accès reste ouvert jusqu'au terme de la période déjà réglée.`,
      )
    : "";

  const bodyHtml =
    heading(
      "Merci, votre paiement est confirmé",
      `Bonjour ${escHtml(d.adminFirstName)}, nous avons bien reçu votre règlement pour le cabinet <strong style="color:${NAVY};">${escHtml(d.cabinetName)}</strong>. En voici le récapitulatif.`,
    ) +
    kvCard(rows) +
    callout(
      `<strong style="color:${NAVY};">Votre espace est en cours de création.</strong> Vous allez recevoir l'email de bienvenue de l'application MediCare&nbsp;Pro, avec votre lien de connexion et vos identifiants d'accès. Pensez à vérifier vos courriers indésirables s'il n'apparaît pas d'ici quelques minutes.`,
    ) +
    renewalHtml +
    paragraph(
      `Conservez cet email&nbsp;: il fait office de reçu pour votre comptabilité.`,
    );

  const text = [
    "MediCare Pro — Reçu de paiement",
    "",
    `Bonjour ${d.adminFirstName},`,
    `Nous avons bien reçu votre règlement pour le cabinet ${d.cabinetName}.`,
    "",
    `Cabinet            ${d.cabinetName}`,
    `Formule            ${d.planLabel}`,
    `Montant réglé TTC  ${d.amountLabel}`,
    `Référence          ${d.reference}`,
    `Date du paiement   ${d.paidAtLabel}`,
    ...(d.invoiceNumber ? [`Facture            ${d.invoiceNumber}`] : []),
    "",
    "Votre espace est en cours de création : vous allez recevoir l'email de",
    "bienvenue de l'application MediCare Pro, avec votre lien de connexion.",
    ...(d.renewal
      ? [
          "",
          "Abonnement à reconduction automatique : il sera renouvelé",
          `${d.renewal.periodLabel} pour ${d.renewal.amountLabel} TTC sur la carte utilisée`,
          `aujourd'hui, à partir du ${d.renewal.nextDateLabel}. Pour l'arrêter, écrivez-nous`,
          "à contact@medicarepro.fr : votre accès reste ouvert jusqu'au terme de la",
          "période déjà réglée.",
        ]
      : []),
    "",
    "Conservez cet email : il fait office de reçu pour votre comptabilité.",
    "Une question ? contact@medicarepro.fr",
  ].join("\n");

  return {
    subject,
    text,
    html: emailShell({
      title: subject,
      preheader: `Merci ${d.adminFirstName} — ${d.amountLabel} réglés pour ${d.cabinetName}. Votre espace arrive.`,
      badge: "Paiement confirmé",
      bodyHtml,
      footerNoteHtml: CLIENT_FOOTER_NOTE,
    }),
  };
}

/* ============================================================
   2. Incident de provisioning (client) — rassurant, SANS détail
   technique : le paiement est enregistré, l'équipe prend le relais.
   ============================================================ */

/* ============================================================
   Reçu d'échéance — reconduction automatique de l'abonnement.
   Envoyé à chaque débit rejoué par le TPE récurrent Monetico.
   Mentions attendues pour un abonnement : ce qui vient d'être
   prélevé, la période couverte, et comment arrêter.
   ============================================================ */

export type RenewalReceiptData = {
  adminFirstName: string;
  cabinetName: string;
  planLabel: string;
  amountLabel: string;
  reference: string;
  paidAtLabel: string;
  /** Fin de la nouvelle période couverte, déjà formatée. */
  periodEndLabel: string;
  invoiceNumber?: string;
};

export function renewalReceiptEmail(d: RenewalReceiptData): EmailContent {
  const subject = "Votre abonnement est reconduit — MediCare Pro";

  const rows: KvRow[] = [
    { label: "Cabinet", valueHtml: escHtml(d.cabinetName) },
    { label: "Formule", valueHtml: escHtml(d.planLabel) },
    { label: "Montant prélevé TTC", valueHtml: escHtml(d.amountLabel) },
    { label: "Date du prélèvement", valueHtml: escHtml(d.paidAtLabel) },
    { label: "Couvert jusqu'au", valueHtml: escHtml(d.periodEndLabel) },
    { label: "Référence", valueHtml: mono(d.reference) },
  ];
  if (d.invoiceNumber) {
    rows.push({ label: "Facture", valueHtml: escHtml(d.invoiceNumber) });
  }

  const bodyHtml =
    heading(
      "Votre abonnement continue",
      `Bonjour ${escHtml(d.adminFirstName)}, l'abonnement du cabinet <strong style="color:${NAVY};">${escHtml(d.cabinetName)}</strong> vient d'être reconduit automatiquement. Aucune action de votre part n'est nécessaire.`,
    ) +
    kvCard(rows) +
    callout(
      `<strong style="color:${NAVY};">Vous gardez la main.</strong> Pour arrêter la reconduction automatique, écrivez-nous à <a href="mailto:contact@medicarepro.fr" style="color:${PRIMARY};text-decoration:none;">contact@medicarepro.fr</a>&nbsp;: votre accès reste ouvert jusqu'au terme de la période déjà réglée.`,
    ) +
    paragraph(
      `Conservez cet email&nbsp;: il fait office de reçu pour votre comptabilité.`,
    );

  const text = [
    "MediCare Pro — Reçu de reconduction",
    "",
    `Bonjour ${d.adminFirstName},`,
    `L'abonnement du cabinet ${d.cabinetName} vient d'être reconduit automatiquement.`,
    "",
    `Cabinet              ${d.cabinetName}`,
    `Formule              ${d.planLabel}`,
    `Montant prélevé TTC  ${d.amountLabel}`,
    `Date du prélèvement  ${d.paidAtLabel}`,
    `Couvert jusqu'au     ${d.periodEndLabel}`,
    `Référence            ${d.reference}`,
    ...(d.invoiceNumber ? [`Facture              ${d.invoiceNumber}`] : []),
    "",
    "Pour arrêter la reconduction automatique, écrivez-nous à",
    "contact@medicarepro.fr : votre accès reste ouvert jusqu'au terme de la",
    "période déjà réglée.",
    "",
    "Conservez cet email : il fait office de reçu pour votre comptabilité.",
  ].join("\n");

  return {
    subject,
    text,
    html: emailShell({
      title: subject,
      preheader: `${d.amountLabel} prélevés pour ${d.cabinetName} — couvert jusqu'au ${d.periodEndLabel}.`,
      badge: "Abonnement reconduit",
      bodyHtml,
      footerNoteHtml: CLIENT_FOOTER_NOTE,
    }),
  };
}

export function provisioningIncidentEmailClient(d: {
  adminFirstName: string;
}): EmailContent {
  const subject = "Votre inscription MediCare Pro — vérification en cours";

  const bodyHtml =
    heading(
      "Votre paiement est bien enregistré",
      `Bonjour ${escHtml(d.adminFirstName)}, un grand merci pour votre confiance.`,
    ) +
    callout(
      `<strong style="color:${NAVY};">Vous n'avez rien à faire.</strong> Une vérification est en cours sur votre dossier&nbsp;: notre équipe finalise l'ouverture de votre espace et vous contacte sous <strong style="color:${NAVY};">24&nbsp;h ouvrées</strong>.`,
    ) +
    paragraph(
      `Votre règlement est bien enregistré et votre inscription est réservée. Si vous souhaitez nous joindre entre-temps, écrivez-nous à <a href="mailto:contact@medicarepro.fr" style="color:${PRIMARY};text-decoration:none;">contact@medicarepro.fr</a>.`,
    );

  const text = [
    "MediCare Pro — Votre inscription est en cours",
    "",
    `Bonjour ${d.adminFirstName},`,
    "",
    "Votre paiement est bien enregistré et votre inscription est réservée.",
    "Une vérification est en cours sur votre dossier : notre équipe finalise",
    "l'ouverture de votre espace et vous contacte sous 24 h ouvrées.",
    "Vous n'avez rien à faire.",
    "",
    "Pour nous joindre entre-temps : contact@medicarepro.fr",
  ].join("\n");

  return {
    subject,
    text,
    html: emailShell({
      title: subject,
      preheader:
        "Votre paiement est bien enregistré — notre équipe vous contacte sous 24 h ouvrées.",
      badge: "Inscription en cours",
      bodyHtml,
      footerNoteHtml: CLIENT_FOOTER_NOTE,
    }),
  };
}

/* ============================================================
   3. Alerte interne billing — sujet préfixé [BILLING],
   titre + lignes factuelles pour l'équipe.
   ============================================================ */

export function billingAlertEmail(d: {
  title: string;
  lines: string[];
}): EmailContent {
  const subject = `[BILLING] ${d.title}`;

  const bodyHtml =
    heading(d.title, "Alerte automatique du système de facturation.") +
    callout(
      d.lines.length > 0
        ? d.lines.map((line) => escHtml(line)).join("<br>")
        : `<span style="color:${MUTED};">Aucun détail fourni.</span>`,
    );

  const text = [
    `[BILLING] ${d.title}`,
    "",
    ...(d.lines.length > 0 ? d.lines : ["(aucun détail fourni)"]),
    "",
    "— Alerte automatique du système de facturation medicarepro.fr.",
  ].join("\n");

  return {
    subject,
    text,
    html: emailShell({
      title: subject,
      preheader: d.title,
      badge: "Alerte interne",
      bodyHtml,
      footerNoteHtml: INTERNAL_FOOTER_NOTE,
    }),
  };
}

/* ============================================================
   4. Copie du mandat SEPA (client) — RUM, IBAN masqué, droits :
   pré-notification ≥ 14 jours, révocation via contact@.
   NB : sendMail() n'a pas de pièces jointes — cet email EST la
   copie de référence (le PDF est archivé côté serveur).
   ============================================================ */

export function sepaMandateCopyEmail(d: {
  adminFirstName: string;
  cabinetName: string;
  rum: string;
  ibanMasked: string;
}): EmailContent {
  const subject = "Copie de votre mandat de prélèvement SEPA — MediCare Pro";

  const bodyHtml =
    heading(
      "Copie de votre mandat SEPA",
      `Bonjour ${escHtml(d.adminFirstName)}, voici la copie du mandat de prélèvement SEPA signé pour le cabinet <strong style="color:${NAVY};">${escHtml(d.cabinetName)}</strong>. Conservez-la avec vos documents.`,
    ) +
    kvCard([
      { label: "Créancier", valueHtml: escHtml("MEDICARE PRO") },
      { label: "Référence du mandat (RUM)", valueHtml: mono(d.rum) },
      { label: "Compte débité (IBAN)", valueHtml: mono(d.ibanMasked) },
      { label: "Type de paiement", valueHtml: escHtml("Prélèvement récurrent") },
    ]) +
    callout(
      `Chaque prélèvement vous sera <strong style="color:${NAVY};">pré-notifié au moins 14&nbsp;jours avant son échéance</strong>, avec le montant et la date exacts. Vous pouvez révoquer ce mandat à tout moment en écrivant à <a href="mailto:contact@medicarepro.fr" style="color:${PRIMARY};text-decoration:none;">contact@medicarepro.fr</a>.`,
    );

  const text = [
    "MediCare Pro — Copie de votre mandat de prélèvement SEPA",
    "",
    `Bonjour ${d.adminFirstName},`,
    `Voici la copie du mandat SEPA signé pour le cabinet ${d.cabinetName}.`,
    "Conservez-la avec vos documents.",
    "",
    "Créancier                  MEDICARE PRO",
    `Référence du mandat (RUM)  ${d.rum}`,
    `Compte débité (IBAN)       ${d.ibanMasked}`,
    "Type de paiement           Prélèvement récurrent",
    "",
    "Chaque prélèvement vous sera pré-notifié au moins 14 jours avant son",
    "échéance, avec le montant et la date exacts. Vous pouvez révoquer ce",
    "mandat à tout moment en écrivant à contact@medicarepro.fr.",
  ].join("\n");

  return {
    subject,
    text,
    html: emailShell({
      title: subject,
      preheader: `Mandat SEPA ${d.rum} — cabinet ${d.cabinetName}.`,
      badge: "Mandat SEPA",
      bodyHtml,
      footerNoteHtml: CLIENT_FOOTER_NOTE,
    }),
  };
}
