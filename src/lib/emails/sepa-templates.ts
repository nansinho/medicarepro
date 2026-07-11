import "server-only";

/* ============================================================
   Templates email du cycle de vie SEPA (BILLING-2) — MediCare Pro.
   Réutilise les briques visuelles des templates du tunnel
   (checkout-templates.ts) : carte 600 px, en-tête dégradé + logo
   bouclier, encadrés sobres, badges HDS/RGPD.

   - sepaPrenotificationEmail : pré-notification LÉGALE d'échéance
     (montant + date exacts, ICS + RUM obligatoires).
   - sepaRejectedEmail        : rejet de prélèvement (client).
   - sepaRenewalToApplyEmail  : alerte interne synchro app
     (renouvellement encaissé → nouvelle expiration à reporter).
   ============================================================ */

import {
  type EmailContent,
  CLIENT_FOOTER_NOTE,
  INTERNAL_FOOTER_NOTE,
  callout,
  emailShell,
  escHtml,
  heading,
  kvCard,
  mono,
  paragraph,
} from "./checkout-templates";

const NAVY = "#274760";
const PRIMARY = "#2b6fd6";

/* ============================================================
   1. Pré-notification de prélèvement (client) — mention légale :
   le débiteur doit connaître le montant et la date EXACTS de
   l'échéance, ainsi que l'ICS du créancier et la RUM du mandat.
   ============================================================ */

export function sepaPrenotificationEmail(d: {
  adminFirstName: string;
  cabinetName: string;
  amountLabel: string;
  collectionDateLabel: string;
  rum: string;
  ics: string;
  creditorName: string;
  ibanMasked: string;
}): EmailContent {
  const subject = `Pré-notification de prélèvement SEPA — ${d.amountLabel} le ${d.collectionDateLabel}`;

  const bodyHtml =
    heading(
      "Votre prochain prélèvement SEPA",
      `Bonjour ${escHtml(d.adminFirstName)}, conformément au mandat SEPA signé pour le cabinet <strong style="color:${NAVY};">${escHtml(d.cabinetName)}</strong>, l'échéance de votre abonnement MediCare&nbsp;Pro sera présentée comme suit.`,
    ) +
    kvCard([
      { label: "Montant exact TTC", valueHtml: escHtml(d.amountLabel) },
      { label: "Date de prélèvement", valueHtml: escHtml(d.collectionDateLabel) },
      { label: "Créancier", valueHtml: escHtml(d.creditorName) },
      { label: "ICS (identifiant créancier)", valueHtml: mono(d.ics) },
      { label: "RUM (référence du mandat)", valueHtml: mono(d.rum) },
      { label: "Compte débité (IBAN)", valueHtml: mono(d.ibanMasked) },
    ]) +
    callout(
      `Le montant et la date ci-dessus sont <strong style="color:${NAVY};">exacts et définitifs</strong> pour cette échéance. Merci de vous assurer que votre compte est suffisamment approvisionné à cette date.`,
    ) +
    paragraph(
      `Une question sur cette échéance, ou besoin de révoquer votre mandat&nbsp;? Écrivez-nous à <a href="mailto:contact@medicarepro.fr" style="color:${PRIMARY};text-decoration:none;">contact@medicarepro.fr</a>.`,
    );

  const text = [
    "MediCare Pro — Pré-notification de prélèvement SEPA",
    "",
    `Bonjour ${d.adminFirstName},`,
    `Conformément au mandat SEPA signé pour le cabinet ${d.cabinetName},`,
    "l'échéance de votre abonnement MediCare Pro sera présentée comme suit :",
    "",
    `Montant exact TTC            ${d.amountLabel}`,
    `Date de prélèvement          ${d.collectionDateLabel}`,
    `Créancier                    ${d.creditorName}`,
    `ICS (identifiant créancier)  ${d.ics}`,
    `RUM (référence du mandat)    ${d.rum}`,
    `Compte débité (IBAN)         ${d.ibanMasked}`,
    "",
    "Le montant et la date ci-dessus sont exacts et définitifs pour cette",
    "échéance. Merci de vous assurer que votre compte est suffisamment",
    "approvisionné à cette date.",
    "",
    "Question ou révocation du mandat : contact@medicarepro.fr",
  ].join("\n");

  return {
    subject,
    text,
    html: emailShell({
      title: subject,
      preheader: `${d.amountLabel} seront prélevés le ${d.collectionDateLabel} — RUM ${d.rum}.`,
      badge: "Prélèvement à venir",
      bodyHtml,
      footerNoteHtml: CLIENT_FOOTER_NOTE,
    }),
  };
}

/* ============================================================
   2. Rejet de prélèvement (client) — factuel et actionnable :
   le montant refusé + ce qui va se passer (retryInfo).
   ============================================================ */

export function sepaRejectedEmail(d: {
  adminFirstName: string;
  amountLabel: string;
  retryInfo: string;
}): EmailContent {
  const subject = "Prélèvement refusé — votre abonnement MediCare Pro";

  const bodyHtml =
    heading(
      "Votre prélèvement n'a pas abouti",
      `Bonjour ${escHtml(d.adminFirstName)}, le prélèvement de <strong style="color:${NAVY};">${escHtml(d.amountLabel)}</strong> au titre de votre abonnement MediCare&nbsp;Pro a été refusé par votre banque.`,
    ) +
    callout(escHtml(d.retryInfo)) +
    paragraph(
      `Merci de vérifier que votre compte est suffisamment approvisionné et qu'aucune opposition ne bloque le prélèvement. Si besoin, écrivez-nous à <a href="mailto:contact@medicarepro.fr" style="color:${PRIMARY};text-decoration:none;">contact@medicarepro.fr</a>&nbsp;: nous trouverons une solution ensemble.`,
    );

  const text = [
    "MediCare Pro — Prélèvement refusé",
    "",
    `Bonjour ${d.adminFirstName},`,
    `Le prélèvement de ${d.amountLabel} au titre de votre abonnement`,
    "MediCare Pro a été refusé par votre banque.",
    "",
    d.retryInfo,
    "",
    "Merci de vérifier que votre compte est suffisamment approvisionné et",
    "qu'aucune opposition ne bloque le prélèvement. Si besoin, écrivez-nous",
    "à contact@medicarepro.fr : nous trouverons une solution ensemble.",
  ].join("\n");

  return {
    subject,
    text,
    html: emailShell({
      title: subject,
      preheader: `Le prélèvement de ${d.amountLabel} a été refusé — voici la marche à suivre.`,
      badge: "Action requise",
      bodyHtml,
      footerNoteHtml: CLIENT_FOOTER_NOTE,
    }),
  };
}

/* ============================================================
   3. Renouvellement à appliquer (alerte INTERNE) — le prélèvement
   de renouvellement est encaissé, la nouvelle date d'expiration
   doit être reportée dans l'application (app_sync_tasks).
   ============================================================ */

export function sepaRenewalToApplyEmail(d: {
  cabinetName: string;
  appCabinetId: string;
  newExpiresAtLabel: string;
}): EmailContent {
  const subject = `[BILLING] Renouvellement à appliquer — ${d.cabinetName}`;

  const bodyHtml =
    heading(
      "Renouvellement encaissé — synchro app à appliquer",
      "Le prélèvement de renouvellement a été encaissé. La nouvelle date d'expiration doit être reportée dans l'application.",
    ) +
    kvCard([
      { label: "Cabinet", valueHtml: escHtml(d.cabinetName) },
      { label: "ID cabinet (app)", valueHtml: mono(d.appCabinetId) },
      { label: "Nouvelle expiration", valueHtml: escHtml(d.newExpiresAtLabel) },
    ]) +
    callout(
      `À faire&nbsp;: reporter la nouvelle date d'expiration sur ce cabinet dans l'application, puis marquer la tâche de synchro correspondante comme faite (app_sync_tasks, kind «&nbsp;renewal&nbsp;»).`,
    );

  const text = [
    `[BILLING] Renouvellement à appliquer — ${d.cabinetName}`,
    "",
    "Le prélèvement de renouvellement a été encaissé. La nouvelle date",
    "d'expiration doit être reportée dans l'application.",
    "",
    `Cabinet              ${d.cabinetName}`,
    `ID cabinet (app)     ${d.appCabinetId}`,
    `Nouvelle expiration  ${d.newExpiresAtLabel}`,
    "",
    "À faire : reporter la nouvelle date d'expiration sur ce cabinet dans",
    "l'application, puis marquer la tâche de synchro comme faite",
    "(app_sync_tasks, kind « renewal »).",
  ].join("\n");

  return {
    subject,
    text,
    html: emailShell({
      title: subject,
      preheader: `${d.cabinetName} — nouvelle expiration ${d.newExpiresAtLabel} à reporter dans l'app.`,
      badge: "Alerte interne",
      bodyHtml,
      footerNoteHtml: INTERNAL_FOOTER_NOTE,
    }),
  };
}
