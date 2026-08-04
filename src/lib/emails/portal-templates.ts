import "server-only";

/* ============================================================
   Templates email de l'espace abonnement du praticien.
   Réutilise les briques visuelles des templates du tunnel
   (checkout-templates.ts) : carte 600 px, en-tête dégradé + logo,
   encadrés sobres, badges HDS/RGPD.

   TOUS CES EMAILS DISENT LA MÊME CHOSE DIFFICILE : la reconduction
   automatique s'arrête au moment de la demande, et le client devra
   valider un paiement à l'échéance. On ne l'enrobe pas — un client
   qui découvre à l'échéance qu'il n'est plus reconduit, c'est un
   cabinet coupé un lundi matin.
   ============================================================ */

import {
  type EmailContent,
  CLIENT_FOOTER_NOTE,
  callout,
  emailShell,
  escHtml,
  heading,
  kvCard,
  paragraph,
} from "./checkout-templates";

const NAVY = "#274760";
const PRIMARY = "#2b6fd6";

type KvRow = { label: string; valueHtml: string };

/* ============================================================
   1. Résiliation enregistrée — l'accès court jusqu'au terme.
   ============================================================ */

export function cancellationScheduledEmail(d: {
  adminFirstName: string;
  cabinetName: string;
  currentPlanLabel: string;
  accessUntilLabel: string;
}): EmailContent {
  const subject = "Votre résiliation est enregistrée — MediCare Pro";

  const rows: KvRow[] = [
    { label: "Cabinet", valueHtml: escHtml(d.cabinetName) },
    { label: "Formule résiliée", valueHtml: escHtml(d.currentPlanLabel) },
    { label: "Accès jusqu'au", valueHtml: escHtml(d.accessUntilLabel) },
    { label: "Prochain prélèvement", valueHtml: "aucun" },
  ];

  const bodyHtml =
    heading(
      "Votre résiliation est enregistrée",
      `Bonjour ${escHtml(d.adminFirstName)}, nous avons bien pris en compte la résiliation de l'abonnement du cabinet <strong style="color:${NAVY};">${escHtml(d.cabinetName)}</strong>.`,
    ) +
    kvCard(rows) +
    callout(
      `<strong style="color:${NAVY};">Vous gardez l'accès complet jusqu'au ${escHtml(d.accessUntilLabel)}</strong>, période que vous avez déjà réglée. Aucun nouveau prélèvement ne sera effectué : votre banque a confirmé l'arrêt de la reconduction.`,
    ) +
    paragraph(
      `Vos données restent les vôtres. Pensez à faire vos exports depuis le logiciel avant la fin de l'accès, et écrivez-nous à <a href="mailto:contact@medicarepro.fr" style="color:${PRIMARY};text-decoration:none;">contact@medicarepro.fr</a> si vous avez besoin d'aide.`,
    ) +
    paragraph(
      `Vous changez d'avis&nbsp;? Vous pouvez reprendre votre abonnement à tout moment depuis votre espace, sans rien perdre de vos dossiers.`,
    );

  const text = [
    "MediCare Pro — Résiliation enregistrée",
    "",
    `Bonjour ${d.adminFirstName},`,
    `Nous avons bien pris en compte la résiliation de l'abonnement du cabinet`,
    `${d.cabinetName}.`,
    "",
    `Cabinet               ${d.cabinetName}`,
    `Formule résiliée      ${d.currentPlanLabel}`,
    `Accès jusqu'au        ${d.accessUntilLabel}`,
    `Prochain prélèvement  aucun`,
    "",
    `Vous gardez l'accès complet jusqu'au ${d.accessUntilLabel}, période que`,
    "vous avez déjà réglée. Aucun nouveau prélèvement ne sera effectué.",
    "",
    "Pensez à faire vos exports depuis le logiciel avant la fin de l'accès.",
    "Vous changez d'avis ? Vous pouvez reprendre votre abonnement à tout",
    "moment depuis votre espace, sans rien perdre de vos dossiers.",
    "",
    "Une question : contact@medicarepro.fr",
  ].join("\n");

  return {
    subject,
    text,
    html: emailShell({
      title: subject,
      preheader: `${d.cabinetName} — accès complet jusqu'au ${d.accessUntilLabel}, plus aucun prélèvement.`,
      badge: "Résiliation",
      bodyHtml,
      footerNoteHtml: CLIENT_FOOTER_NOTE,
    }),
  };
}

/* ============================================================
   2. Changement de formule ou de carte enregistré.

   LE POINT DUR EST ICI : la reconduction automatique vient d'être
   arrêtée, et le client doit VALIDER UN PAIEMENT à l'échéance,
   sinon il perd l'accès. C'est la contrepartie de ne pas lui faire
   payer deux fois le mois en cours. On le met en tête, pas en
   petits caractères.
   ============================================================ */

export function changeScheduledEmail(d: {
  adminFirstName: string;
  cabinetName: string;
  kind: "plan_change" | "card_update";
  currentPlanLabel: string;
  targetPlanLabel: string;
  targetAmountLabel: string;
  effectiveAtLabel: string;
}): EmailContent {
  const isCard = d.kind === "card_update";
  const subject = isCard
    ? "Votre changement de carte est enregistré — MediCare Pro"
    : "Votre changement de formule est enregistré — MediCare Pro";

  const rows: KvRow[] = [
    { label: "Cabinet", valueHtml: escHtml(d.cabinetName) },
    { label: "Formule actuelle", valueHtml: escHtml(d.currentPlanLabel) },
  ];
  if (!isCard) {
    rows.push({
      label: "Nouvelle formule",
      valueHtml: escHtml(d.targetPlanLabel),
    });
  }
  rows.push(
    { label: "À régler le", valueHtml: escHtml(d.effectiveAtLabel) },
    { label: "Montant TTC", valueHtml: escHtml(d.targetAmountLabel) },
  );

  const bodyHtml =
    heading(
      isCard
        ? "Votre changement de carte est enregistré"
        : "Votre nouvelle formule est enregistrée",
      `Bonjour ${escHtml(d.adminFirstName)}, votre demande pour le cabinet <strong style="color:${NAVY};">${escHtml(d.cabinetName)}</strong> est bien prise en compte. Elle prendra effet le <strong style="color:${NAVY};">${escHtml(d.effectiveAtLabel)}</strong>, à la fin de la période que vous avez déjà réglée.`,
    ) +
    kvCard(rows) +
    callout(
      `<strong style="color:${NAVY};">Une action vous sera demandée le ${escHtml(d.effectiveAtLabel)}.</strong> Votre reconduction automatique est arrêtée&nbsp;: ${isCard ? "votre nouvelle carte ne peut pas remplacer l'ancienne sur un prélèvement déjà programmé" : "le montant d'un prélèvement en cours ne peut pas être modifié"}. Vous validerez donc ${isCard ? "votre nouvelle carte" : "votre nouvelle formule"} par un paiement depuis votre espace, et tout repartira automatiquement ensuite. Nous vous préviendrons une semaine avant, puis la veille.`,
    ) +
    paragraph(
      `D'ici là, rien ne change&nbsp;: vous gardez l'accès complet et aucun montant ne sera débité. Vous pouvez aussi revenir sur cette demande depuis votre espace.`,
    );

  const text = [
    isCard
      ? "MediCare Pro — Changement de carte enregistré"
      : "MediCare Pro — Changement de formule enregistré",
    "",
    `Bonjour ${d.adminFirstName},`,
    `Votre demande pour le cabinet ${d.cabinetName} est bien prise en compte.`,
    `Elle prendra effet le ${d.effectiveAtLabel}, à la fin de la période que`,
    "vous avez déjà réglée.",
    "",
    `Cabinet            ${d.cabinetName}`,
    `Formule actuelle   ${d.currentPlanLabel}`,
    ...(isCard ? [] : [`Nouvelle formule   ${d.targetPlanLabel}`]),
    `À régler le        ${d.effectiveAtLabel}`,
    `Montant TTC        ${d.targetAmountLabel}`,
    "",
    `IMPORTANT : une action vous sera demandée le ${d.effectiveAtLabel}.`,
    "Votre reconduction automatique est arrêtée. Vous validerez",
    isCard ? "votre nouvelle carte" : "votre nouvelle formule",
    "par un paiement depuis votre espace, et tout repartira",
    "automatiquement ensuite. Nous vous préviendrons une semaine",
    "avant, puis la veille.",
    "",
    "D'ici là, rien ne change : accès complet, aucun montant débité.",
    "",
    "Une question : contact@medicarepro.fr",
  ].join("\n");

  return {
    subject,
    text,
    html: emailShell({
      title: subject,
      preheader: `${d.cabinetName} — effet le ${d.effectiveAtLabel}. Un paiement sera à valider ce jour-là.`,
      badge: isCard ? "Changement de carte" : "Changement de formule",
      bodyHtml,
      footerNoteHtml: CLIENT_FOOTER_NOTE,
    }),
  };
}

/* ============================================================
   3. Demande retirée — la formule d'origine est conservée, MAIS la
   reconduction automatique ne revient pas. On ne peut pas la
   ressusciter : l'arrêt envoyé à la banque est définitif.
   ============================================================ */

export function changeWithdrawnEmail(d: {
  adminFirstName: string;
  cabinetName: string;
  wasCancellation: boolean;
  currentPlanLabel: string;
  renewOnLabel: string;
  renewAmountLabel: string;
}): EmailContent {
  const subject = d.wasCancellation
    ? "Votre résiliation est annulée — MediCare Pro"
    : "Votre demande est annulée — MediCare Pro";

  const rows: KvRow[] = [
    { label: "Cabinet", valueHtml: escHtml(d.cabinetName) },
    { label: "Formule conservée", valueHtml: escHtml(d.currentPlanLabel) },
    { label: "À renouveler le", valueHtml: escHtml(d.renewOnLabel) },
    { label: "Montant TTC", valueHtml: escHtml(d.renewAmountLabel) },
  ];

  const bodyHtml =
    heading(
      d.wasCancellation
        ? "Votre résiliation est annulée"
        : "Votre demande est annulée",
      `Bonjour ${escHtml(d.adminFirstName)}, c'est noté&nbsp;: le cabinet <strong style="color:${NAVY};">${escHtml(d.cabinetName)}</strong> conserve sa formule <strong style="color:${NAVY};">${escHtml(d.currentPlanLabel)}</strong>.`,
    ) +
    kvCard(rows) +
    callout(
      `<strong style="color:${NAVY};">Un point à connaître&nbsp;:</strong> la reconduction automatique avait été arrêtée auprès de votre banque au moment de votre demande, et cet arrêt est définitif. Votre abonnement ne se renouvellera donc pas tout seul le ${escHtml(d.renewOnLabel)}&nbsp;: vous le reconduirez par un paiement depuis votre espace, et l'automatisme reprendra ensuite. Nous vous préviendrons avant l'échéance.`,
    ) +
    paragraph(
      `Rien d'autre ne change&nbsp;: votre accès et vos données sont intacts.`,
    );

  const text = [
    d.wasCancellation
      ? "MediCare Pro — Résiliation annulée"
      : "MediCare Pro — Demande annulée",
    "",
    `Bonjour ${d.adminFirstName},`,
    `C'est noté : le cabinet ${d.cabinetName} conserve sa formule`,
    `${d.currentPlanLabel}.`,
    "",
    `Cabinet            ${d.cabinetName}`,
    `Formule conservée  ${d.currentPlanLabel}`,
    `À renouveler le    ${d.renewOnLabel}`,
    `Montant TTC        ${d.renewAmountLabel}`,
    "",
    "À CONNAÎTRE : la reconduction automatique avait été arrêtée auprès de",
    "votre banque au moment de votre demande, et cet arrêt est définitif.",
    `Votre abonnement ne se renouvellera donc pas tout seul le ${d.renewOnLabel} :`,
    "vous le reconduirez par un paiement depuis votre espace, et",
    "l'automatisme reprendra ensuite. Nous vous préviendrons avant.",
    "",
    "Une question : contact@medicarepro.fr",
  ].join("\n");

  return {
    subject,
    text,
    html: emailShell({
      title: subject,
      preheader: `${d.cabinetName} — formule conservée, renouvellement à valider le ${d.renewOnLabel}.`,
      badge: "Demande annulée",
      bodyHtml,
      footerNoteHtml: CLIENT_FOOTER_NOTE,
    }),
  };
}

/* ============================================================
   4. Rappel : l'échéance approche et un paiement est à valider.

   Distinct du rappel annuel (renewalReminderEmail) : là, le client
   a DEMANDÉ quelque chose, et ce qu'il doit valider n'est pas la
   formule qu'il connaît. Le montant annoncé doit être le nouveau.
   ============================================================ */

export function changeReminderEmail(d: {
  adminFirstName: string;
  cabinetName: string;
  kind: "plan_change" | "card_update" | "renewal";
  planLabel: string;
  amountLabel: string;
  dueAtLabel: string;
  daysBefore: number;
  /** Lien d'entrée dans l'espace. Absent = repli sur le contact. */
  portalUrl?: string;
}): EmailContent {
  const late = d.daysBefore < 0;
  const whenText = late
    ? `depuis ${Math.abs(d.daysBefore)} jour${Math.abs(d.daysBefore) > 1 ? "s" : ""}`
    : d.daysBefore === 0
      ? "aujourd'hui"
      : d.daysBefore === 1
        ? "demain"
        : `dans ${d.daysBefore} jours`;

  const what =
    d.kind === "card_update"
      ? "votre nouvelle carte"
      : d.kind === "plan_change"
        ? "votre nouvelle formule"
        : "votre abonnement";

  const subject = late
    ? `Action requise : ${what} n'est pas encore validée — MediCare Pro`
    : d.daysBefore === 0
      ? `À valider aujourd'hui : ${what} — MediCare Pro`
      : `À valider ${whenText} : ${what} — MediCare Pro`;

  const rows: KvRow[] = [
    { label: "Cabinet", valueHtml: escHtml(d.cabinetName) },
    { label: "Formule", valueHtml: escHtml(d.planLabel) },
    { label: "Montant TTC", valueHtml: escHtml(d.amountLabel) },
    { label: "Échéance", valueHtml: escHtml(d.dueAtLabel) },
  ];

  const bodyHtml =
    heading(
      late ? "Votre accès est menacé" : `À valider ${whenText}`,
      late
        ? `Bonjour ${escHtml(d.adminFirstName)}, l'échéance du cabinet <strong style="color:${NAVY};">${escHtml(d.cabinetName)}</strong> est passée le <strong style="color:${NAVY};">${escHtml(d.dueAtLabel)}</strong> et ${what} n'a pas encore été validée.`
        : `Bonjour ${escHtml(d.adminFirstName)}, ${what} pour le cabinet <strong style="color:${NAVY};">${escHtml(d.cabinetName)}</strong> prend effet le <strong style="color:${NAVY};">${escHtml(d.dueAtLabel)}</strong>. Un paiement est à valider pour qu'elle s'applique.`,
    ) +
    kvCard(rows) +
    (d.portalUrl
      ? callout(
          `<strong style="color:${NAVY};">Validez en une minute&nbsp;:</strong> <a href="${escHtml(d.portalUrl)}" style="color:${PRIMARY};text-decoration:none;font-weight:bold;">ouvrir mon espace abonnement →</a>. Votre reconduction automatique repartira aussitôt.`,
        )
      : callout(
          `<strong style="color:${NAVY};">Pour valider&nbsp;:</strong> ouvrez votre espace abonnement depuis le bouton «&nbsp;Gérer mon abonnement&nbsp;» de la page Cabinet, dans votre logiciel. Votre reconduction automatique repartira aussitôt.`,
        )) +
    paragraph(
      late
        ? `Sans validation, l'accès de votre cabinet passera en lecture seule, puis sera fermé. Vos données restent conservées et vous pouvez reprendre à tout moment.`
        : `Si vous préférez ne pas donner suite, vous n'avez rien à faire&nbsp;: votre abonnement prendra fin à l'échéance, et vos données resteront conservées.`,
    );

  const text = [
    "MediCare Pro — Validation à effectuer",
    "",
    `Bonjour ${d.adminFirstName},`,
    late
      ? `L'échéance du cabinet ${d.cabinetName} est passée le ${d.dueAtLabel} et`
      : `${what.charAt(0).toUpperCase()}${what.slice(1)} pour le cabinet ${d.cabinetName} prend effet le`,
    late ? `${what} n'a pas encore été validée.` : `${d.dueAtLabel}.`,
    "",
    `Cabinet      ${d.cabinetName}`,
    `Formule      ${d.planLabel}`,
    `Montant TTC  ${d.amountLabel}`,
    `Échéance     ${d.dueAtLabel}`,
    "",
    ...(d.portalUrl
      ? ["Validez en une minute :", d.portalUrl]
      : [
          "Pour valider, ouvrez votre espace abonnement depuis le bouton",
          "« Gérer mon abonnement » de la page Cabinet, dans votre logiciel.",
        ]),
    "Votre reconduction automatique repartira aussitôt.",
    "",
    late
      ? "Sans validation, l'accès passera en lecture seule, puis sera fermé."
      : "Si vous préférez ne pas donner suite, vous n'avez rien à faire.",
    "Vos données restent conservées dans tous les cas.",
    "",
    "Une question : contact@medicarepro.fr",
  ].join("\n");

  return {
    subject,
    text,
    html: emailShell({
      title: subject,
      preheader: `${d.cabinetName} — ${d.amountLabel} à valider, échéance du ${d.dueAtLabel}.`,
      badge: late ? "Action requise" : "Échéance à venir",
      bodyHtml,
      footerNoteHtml: CLIENT_FOOTER_NOTE,
    }),
  };
}
