import {
  callout,
  ctaButton,
  emailShell,
  escHtml,
  heading,
  kvCard,
  paragraph,
  type EmailContent,
} from "@/lib/emails/checkout-templates";

/* ============================================================
   BACK OFFICE : les emails des membres de l'équipe.

   Deux moments : l'invitation (choisir son mot de passe et activer le
   compte) et la réinitialisation du mot de passe. Même gabarit que les
   emails clients, pour qu'un membre invité reconnaisse la marque et ne
   prenne pas le message pour un hameçonnage.

   Le lien est un secret à usage unique : il est donné une fois, en
   bouton, puis en clair pour le cas où le bouton ne s'affiche pas.
   ============================================================ */

/* Mêmes valeurs que checkout-templates, qui ne les exporte pas. */
const NAVY = "#274760";
const MUTED = "#9aa8b6";

/** Pied des emails d'équipe : ils ne vont pas à un client. */
const STAFF_FOOTER_NOTE = `Email automatique du back office de <a href="https://medicarepro.fr" style="color:${MUTED};">medicarepro.fr</a>. Vous n'attendiez pas ce message&nbsp;? Ignorez-le&nbsp;: rien ne se passe sans ce lien.`;

export type StaffRole = "admin" | "editor";

const ROLE_LABEL: Record<StaffRole, string> = {
  admin: "administrateur",
  editor: "éditeur",
};

const ROLE_SCOPE: Record<StaffRole, string> = {
  admin:
    "Contenu du site, SEO, facturation, comptes de l'équipe et réglages.",
  editor: "Contenu du site : pages, blog, médias, demandes de contact et SEO.",
};

/** Le lien en clair, sous le bouton (clients mail qui masquent les boutons). */
function plainLink(link: string): string {
  return `Si le bouton ne s'affiche pas, copiez cette adresse dans votre navigateur&nbsp;:<br><span style="word-break:break-all;color:${NAVY};">${escHtml(link)}</span>`;
}

/* ------------------------------------------------------------
   1. Invitation.
   ------------------------------------------------------------ */

export function staffInviteEmail(d: {
  link: string;
  role: StaffRole;
  email: string;
  /** Nom de la personne qui invite, s'il est connu. */
  inviterName?: string | null;
  /** Durée de validité du lien, en heures. */
  validHours: number;
}): EmailContent {
  const roleLabel = ROLE_LABEL[d.role];
  const subject = "Votre accès au back office MediCare Pro";
  const qui = d.inviterName
    ? `${escHtml(d.inviterName)} vous invite`
    : "Vous êtes invité(e)";

  const bodyHtml =
    heading(
      "Rejoignez le back office MediCare Pro",
      `${qui} à rejoindre le back office de medicarepro.fr en tant que <strong style="color:${NAVY};">${roleLabel}</strong>. Choisissez votre mot de passe pour activer votre compte.`,
    ) +
    kvCard([
      { label: "Identifiant", valueHtml: escHtml(d.email) },
      { label: "Rôle", valueHtml: roleLabel[0].toUpperCase() + roleLabel.slice(1) },
    ]) +
    ctaButton(
      "Activer mon compte",
      d.link,
      `Lien personnel, valable ${d.validHours}&nbsp;heures et utilisable une seule fois.`,
    ) +
    callout(
      `<strong style="color:${NAVY};">Accès ${roleLabel}.</strong> ${ROLE_SCOPE[d.role]}`,
    ) +
    paragraph(
      `Le lien a expiré&nbsp;? Demandez à la personne qui vous a invité(e) de vous le renvoyer&nbsp;: un nouveau lien remplace l'ancien.`,
    ) +
    paragraph(`<span style="font-size:12px;color:${MUTED};">${plainLink(d.link)}</span>`);

  const text = [
    "MediCare Pro : votre accès au back office",
    "",
    `${d.inviterName ? `${d.inviterName} vous invite` : "Vous êtes invité(e)"} à rejoindre le back office de medicarepro.fr en tant que ${roleLabel}.`,
    "",
    `Identifiant : ${d.email}`,
    "",
    "Choisissez votre mot de passe pour activer votre compte :",
    d.link,
    "",
    `Ce lien est personnel, valable ${d.validHours} heures et utilisable une seule fois.`,
    "S'il a expiré, demandez qu'on vous le renvoie : un nouveau lien remplace l'ancien.",
    "",
    "Vous n'attendiez pas ce message ? Ignorez-le : rien ne se passe sans ce lien.",
  ].join("\n");

  return {
    subject,
    text,
    html: emailShell({
      title: subject,
      preheader: `Choisissez votre mot de passe pour activer votre accès ${roleLabel}.`,
      badge: "Invitation",
      bodyHtml,
      footerNoteHtml: STAFF_FOOTER_NOTE,
    }),
  };
}

/* ------------------------------------------------------------
   2. Réinitialisation du mot de passe.
   ------------------------------------------------------------ */

export function staffRecoveryEmail(d: {
  link: string;
  email: string;
  validHours: number;
}): EmailContent {
  const subject = "Back office MediCare Pro : nouveau mot de passe";

  const bodyHtml =
    heading(
      "Choisissez un nouveau mot de passe",
      `Une réinitialisation du mot de passe a été demandée pour le compte <strong style="color:${NAVY};">${escHtml(d.email)}</strong> du back office de medicarepro.fr.`,
    ) +
    ctaButton(
      "Choisir un nouveau mot de passe",
      d.link,
      `Lien valable ${d.validHours}&nbsp;heures et utilisable une seule fois. Votre mot de passe actuel reste valable tant que vous n'en choisissez pas un autre.`,
    ) +
    paragraph(`<span style="font-size:12px;color:${MUTED};">${plainLink(d.link)}</span>`);

  const text = [
    "MediCare Pro : nouveau mot de passe du back office",
    "",
    `Une réinitialisation du mot de passe a été demandée pour le compte ${d.email}.`,
    "",
    "Pour choisir un nouveau mot de passe :",
    d.link,
    "",
    `Ce lien est valable ${d.validHours} heures et utilisable une seule fois.`,
    "Votre mot de passe actuel reste valable tant que vous n'en choisissez pas un autre.",
    "",
    "Vous n'êtes pas à l'origine de cette demande ? Ignorez ce message.",
  ].join("\n");

  return {
    subject,
    text,
    html: emailShell({
      title: subject,
      preheader: "Lien de réinitialisation de votre mot de passe du back office.",
      badge: "Mot de passe",
      bodyHtml,
      footerNoteHtml: STAFF_FOOTER_NOTE,
    }),
  };
}
