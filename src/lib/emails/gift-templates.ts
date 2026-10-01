import {
  CLIENT_FOOTER_NOTE,
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
   ACCÈS OFFERTS : les emails du bénéficiaire.

   Quatre moments : l'invitation, l'ouverture de l'accès, les rappels avant la
   fin, la fin sans abonnement. Chacun dit la même chose sur le point qui
   engage : ce qui se passe à l'échéance. Aucune carte n'est demandée, rien
   n'est prélevé, et le compte passe en lecture seule si le bénéficiaire ne
   s'abonne pas. Jamais d'ambiguïté là-dessus : c'est ce qui évite le
   sentiment d'avoir été piégé.

   Seul le rappel distingue encore deux cas : un bénéficiaire a pu enregistrer
   lui-même un moyen de paiement pendant la période, et son abonnement démarre
   alors à l'échéance. Ce n'est plus jamais demandé à l'inscription (décision
   du 01/10/2026 : une carte demandée faisait renoncer les invités).

   Le motif de l'invitation (« Quiz de l'été ») n'apparaît jamais ici : c'est
   une note interne, pas un texte écrit pour le bénéficiaire.
   ============================================================ */

const STRONG = "color:#274760;";

/** Ce qui se passe à la fin, dit de la même façon dans tous les emails. */
function finDePeriode(months: number): { html: string; text: string } {
  const text = `Aucune carte bancaire n'est demandée. À la fin des ${months} mois, vous choisirez de vous abonner pour continuer. Sinon, vos dossiers restent consultables et exportables : rien n'est supprimé. Nous vous prévenons par email avant la fin.`;
  return {
    html: `<strong style="${STRONG}">Aucune carte bancaire n'est demandée.</strong> À la fin des ${months} mois, vous choisirez de vous abonner pour continuer. Sinon, vos dossiers restent consultables et exportables&nbsp;: rien n'est supprimé. Nous vous prévenons par email avant la fin.`,
    text,
  };
}

/* ------------------------------------------------------------
   1. L'invitation.
   ------------------------------------------------------------ */

export function giftInvitationEmail(d: {
  months: number;
  link: string;
  expiresAtLabel: string;
}): EmailContent {
  const subject = `MediCare Pro vous offre ${d.months} mois d'accès`;
  const fin = finDePeriode(d.months);

  const bodyHtml =
    heading(
      `${d.months} mois de MediCare Pro vous sont offerts`,
      `Bonjour, nous avons le plaisir de vous offrir <strong style="${STRONG}">${d.months} mois d'accès</strong> à MediCare Pro, le logiciel de gestion du cabinet de podologie&nbsp;: dossiers patients, bilans, agenda, facturation et comptabilité.`,
    ) +
    kvCard([
      { label: "Accès offert", valueHtml: `${d.months} mois` },
      { label: "À régler aujourd'hui", valueHtml: "0,00&nbsp;€" },
      { label: "Carte bancaire", valueHtml: "Non demandée" },
    ]) +
    ctaButton(
      "Activer mon accès offert",
      d.link,
      `Lien personnel, valable jusqu'au ${escHtml(d.expiresAtLabel)}. Il est lié à cette adresse email, qui deviendra votre identifiant de connexion.`,
    ) +
    callout(fin.html) +
    paragraph(
      "L'inscription prend quelques minutes&nbsp;: le SIRET et les coordonnées du cabinet, puis votre mot de passe. Vos données de santé sont hébergées en France, chez un hébergeur agréé HDS.",
    );

  const text = [
    subject,
    "",
    "Bonjour,",
    "",
    `Nous avons le plaisir de vous offrir ${d.months} mois d'accès à MediCare Pro, le logiciel de gestion du cabinet de podologie.`,
    "",
    `Accès offert : ${d.months} mois`,
    "À régler aujourd'hui : 0,00 €",
    "Carte bancaire : non demandée",
    "",
    "Activer mon accès offert :",
    d.link,
    `(lien personnel, valable jusqu'au ${d.expiresAtLabel}, lié à cette adresse email)`,
    "",
    fin.text,
    "",
    "Une question : contact@medicarepro.fr",
  ].join("\n");

  return {
    subject,
    text,
    html: emailShell({
      title: subject,
      preheader: `${d.months} mois d'accès offerts, sans rien régler aujourd'hui.`,
      badge: "Accès offert",
      bodyHtml,
      footerNoteHtml: CLIENT_FOOTER_NOTE,
    }),
  };
}

/* ------------------------------------------------------------
   2. L'accès est ouvert (remplace le reçu de paiement).
   ------------------------------------------------------------ */

export function giftWelcomeEmail(d: {
  adminFirstName: string;
  cabinetName: string;
  months: number;
  endsAtLabel: string;
  loginUrl: string;
}): EmailContent {
  const subject = "Votre accès offert à MediCare Pro est ouvert";
  const fin = finDePeriode(d.months);

  const bodyHtml =
    heading(
      "Votre accès offert est ouvert",
      `Bonjour ${escHtml(d.adminFirstName)}, l'espace MediCare Pro de <strong style="${STRONG}">${escHtml(d.cabinetName)}</strong> est prêt. Vous pouvez vous connecter dès maintenant.`,
    ) +
    kvCard([
      { label: "Accès offert", valueHtml: `${d.months} mois` },
      { label: "Jusqu'au", valueHtml: escHtml(d.endsAtLabel) },
      { label: "Réglé aujourd'hui", valueHtml: "0,00&nbsp;€" },
      { label: "Ensuite", valueHtml: "Abonnement à choisir, si vous continuez" },
    ]) +
    ctaButton(
      "Se connecter à MediCare Pro",
      d.loginUrl,
      "Identifiant&nbsp;: l'adresse email de votre inscription.",
    ) +
    callout(fin.html) +
    paragraph(
      "Votre abonnement se gère depuis le logiciel&nbsp;: page Cabinet, bouton «&nbsp;Gérer mon abonnement&nbsp;».",
    );

  const text = [
    subject,
    "",
    `Bonjour ${d.adminFirstName},`,
    "",
    `L'espace MediCare Pro de ${d.cabinetName} est prêt.`,
    "",
    `Accès offert : ${d.months} mois`,
    `Jusqu'au : ${d.endsAtLabel}`,
    "Réglé aujourd'hui : 0,00 €",
    "Ensuite : abonnement à choisir, si vous continuez",
    "",
    `Se connecter : ${d.loginUrl}`,
    "",
    fin.text,
    "",
    "Votre abonnement se gère depuis le logiciel : page Cabinet, bouton « Gérer mon abonnement ».",
  ].join("\n");

  return {
    subject,
    text,
    html: emailShell({
      title: subject,
      preheader: `Accès offert jusqu'au ${d.endsAtLabel}.`,
      badge: "Accès offert",
      bodyHtml,
      footerNoteHtml: CLIENT_FOOTER_NOTE,
    }),
  };
}

/* ------------------------------------------------------------
   3. Rappel avant la fin.
   ------------------------------------------------------------ */

function dansNJours(n: number): string {
  if (n <= 0) return "aujourd'hui";
  if (n === 1) return "demain";
  return `dans ${n} jours`;
}

export function giftReminderEmail(d: {
  adminFirstName: string;
  cabinetName: string;
  endsAtLabel: string;
  daysBefore: number;
  /** Un moyen de paiement est-il enregistré, aujourd'hui, chez Stripe ? */
  hasPaymentMethod: boolean;
  /** « Mensuel sans engagement ». */
  planLabel: string;
  /** « 29,88 € TTC ». */
  amountLabel: string;
  loginUrl: string;
}): EmailContent {
  const quand = dansNJours(d.daysBefore);

  if (d.hasPaymentMethod) {
    const subject = `Votre abonnement MediCare Pro démarre le ${d.endsAtLabel}`;
    const bodyHtml =
      heading(
        `Votre abonnement démarre ${quand}`,
        `Bonjour ${escHtml(d.adminFirstName)}, la période offerte de <strong style="${STRONG}">${escHtml(d.cabinetName)}</strong> se termine le ${escHtml(d.endsAtLabel)}.`,
      ) +
      kvCard([
        { label: "Formule", valueHtml: escHtml(d.planLabel) },
        { label: "Premier prélèvement", valueHtml: `${escHtml(d.amountLabel)}` },
        { label: "Le", valueHtml: escHtml(d.endsAtLabel) },
      ]) +
      paragraph(
        "Rien à faire pour continuer&nbsp;: le prélèvement se fera sur le moyen de paiement enregistré. Pour arrêter avant cette date, rendez-vous dans MediCare Pro, page Cabinet, bouton «&nbsp;Gérer mon abonnement&nbsp;». Votre accès restera alors ouvert jusqu'à la fin de la période offerte.",
      ) +
      ctaButton("Ouvrir MediCare Pro", d.loginUrl);

    const text = [
      subject,
      "",
      `Bonjour ${d.adminFirstName},`,
      "",
      `La période offerte de ${d.cabinetName} se termine le ${d.endsAtLabel}.`,
      `Formule : ${d.planLabel}`,
      `Premier prélèvement : ${d.amountLabel}, le ${d.endsAtLabel}`,
      "",
      "Rien à faire pour continuer. Pour arrêter avant cette date : MediCare Pro, page Cabinet, bouton « Gérer mon abonnement ».",
      "",
      d.loginUrl,
    ].join("\n");

    return {
      subject,
      text,
      html: emailShell({
        title: subject,
        preheader: `Premier prélèvement de ${d.amountLabel} le ${d.endsAtLabel}.`,
        badge: "Accès offert",
        bodyHtml,
        footerNoteHtml: CLIENT_FOOTER_NOTE,
      }),
    };
  }

  const subject = `Votre accès offert à MediCare Pro se termine le ${d.endsAtLabel}`;
  const bodyHtml =
    heading(
      `Votre accès offert se termine ${quand}`,
      `Bonjour ${escHtml(d.adminFirstName)}, la période offerte de <strong style="${STRONG}">${escHtml(d.cabinetName)}</strong> se termine le ${escHtml(d.endsAtLabel)}.`,
    ) +
    callout(
      `<strong style="${STRONG}">Pour continuer à travailler dans MediCare Pro</strong>, enregistrez un moyen de paiement depuis le logiciel&nbsp;: page Cabinet, bouton «&nbsp;Gérer mon abonnement&nbsp;». Rien ne sera prélevé avant le ${escHtml(d.endsAtLabel)}&nbsp;; ensuite, ${escHtml(d.planLabel.toLowerCase())} à ${escHtml(d.amountLabel)}.`,
    ) +
    paragraph(
      "Sans moyen de paiement, votre compte passera en lecture seule à cette date&nbsp;: vos dossiers resteront consultables et exportables, rien n'est supprimé, et vous pourrez vous abonner à tout moment pour retrouver la saisie.",
    ) +
    ctaButton("Ouvrir MediCare Pro", d.loginUrl);

  const text = [
    subject,
    "",
    `Bonjour ${d.adminFirstName},`,
    "",
    `La période offerte de ${d.cabinetName} se termine le ${d.endsAtLabel}.`,
    "",
    "Pour continuer : MediCare Pro, page Cabinet, bouton « Gérer mon abonnement », puis enregistrez un moyen de paiement.",
    `Rien ne sera prélevé avant le ${d.endsAtLabel} ; ensuite, ${d.planLabel.toLowerCase()} à ${d.amountLabel}.`,
    "",
    "Sans moyen de paiement, votre compte passera en lecture seule : vos dossiers resteront consultables et exportables, rien n'est supprimé.",
    "",
    d.loginUrl,
  ].join("\n");

  return {
    subject,
    text,
    html: emailShell({
      title: subject,
      preheader: `Fin de la période offerte le ${d.endsAtLabel}.`,
      badge: "Accès offert",
      bodyHtml,
      footerNoteHtml: CLIENT_FOOTER_NOTE,
    }),
  };
}

/* ------------------------------------------------------------
   4. La période est terminée, sans abonnement.
   ------------------------------------------------------------ */

export function giftEndedEmail(d: {
  adminFirstName: string;
  cabinetName: string;
  endedAtLabel: string;
  loginUrl: string;
}): EmailContent {
  const subject = "Votre période offerte MediCare Pro est terminée";
  const bodyHtml =
    heading(
      "Votre période offerte est terminée",
      `Bonjour ${escHtml(d.adminFirstName)}, l'accès offert de <strong style="${STRONG}">${escHtml(d.cabinetName)}</strong> a pris fin le ${escHtml(d.endedAtLabel)}.`,
    ) +
    callout(
      `<strong style="${STRONG}">Vos dossiers vous attendent, intacts.</strong> Votre compte est en lecture seule&nbsp;: tout reste consultable et exportable. Pour retrouver la saisie, abonnez-vous depuis MediCare Pro, page Cabinet, bouton «&nbsp;Gérer mon abonnement&nbsp;».`,
    ) +
    ctaButton("Ouvrir MediCare Pro", d.loginUrl) +
    paragraph(
      "Merci d'avoir essayé MediCare Pro. Une question, un retour&nbsp;? Répondez simplement à cet email ou écrivez-nous à contact@medicarepro.fr.",
    );

  const text = [
    subject,
    "",
    `Bonjour ${d.adminFirstName},`,
    "",
    `L'accès offert de ${d.cabinetName} a pris fin le ${d.endedAtLabel}.`,
    "",
    "Vos dossiers vous attendent, intacts : votre compte est en lecture seule, tout reste consultable et exportable.",
    "Pour retrouver la saisie : MediCare Pro, page Cabinet, bouton « Gérer mon abonnement ».",
    "",
    d.loginUrl,
  ].join("\n");

  return {
    subject,
    text,
    html: emailShell({
      title: subject,
      preheader: "Vos dossiers restent consultables. Abonnez-vous pour retrouver la saisie.",
      badge: "Accès offert",
      bodyHtml,
      footerNoteHtml: CLIENT_FOOTER_NOTE,
    }),
  };
}
