import "server-only";

/* ============================================================
   Template email de la demande de contact — MediCare Pro.
   Prolongement visuel du site : carte blanche à grand rayon (22px)
   + ombre bleutée signature, en-tête au dégradé des boutons avec le
   VRAI logo bouclier (ShieldPlus) du site, champs à icône, encadré
   message sobre, badges HDS/RGPD du footer.
   HTML email-safe : tables + styles inline, largeur 600 px.
   Palette : miroir des tokens de src/app/globals.css.
   ============================================================ */

const NAVY = "#274760";
const NAVY_SOFT = "#1d3e5e";
const BODY = "#5d6b7b";
const PRIMARY = "#2b6fd6";
const LIGHT = "#eaf3fc"; // fond des encadrés / pastilles
const RULE = "#e6eef7";
const MUTED = "#9aa8b6";
const PAGE_BG = "#eef5fc"; // fond de page (hero pâle du site)
const CARD = "#ffffff";
const GRAD = "linear-gradient(100deg,#3a7fd9,#21487e)"; // dégradé des boutons

/* Pile système sans-serif (propre, pro, rendu natif dans les webmails). */
const SANS =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export type ContactEmailData = {
  name: string;
  email: string;
  tel: string;
  praticiensLabel: string;
  message: string;
  /** Date/heure lisible de réception (rendue par l'appelant). */
  submittedAt: string;
};

/** Échappe le HTML pour éviter toute injection dans le corps de l'email. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* SVG en data-URI, avec trait `stroke` paramétrable (style « lucide »). */
function svg(paths: string, stroke: string, size: number, sw = 1.8): string {
  const s = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(s).toString("base64")}`;
}

/* Pictogramme officiel 2026 (croix + étoile), hébergé sur le site :
   les clients mail bloquent les data-URI mais chargent les images
   distantes — PNG net à 26 px, servi depuis medicarepro.fr. */
const LOGO = "https://medicarepro.fr/icon-192.png";
const ICON_MAIL = svg(
  '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  PRIMARY,
  20,
);
const ICON_PHONE = svg(
  '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/>',
  PRIMARY,
  20,
);
const ICON_USERS = svg(
  '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5"/><path d="M16 4.2a3.5 3.5 0 0 1 0 6.8M21 20c0-2.8-1.8-4.4-4.5-4.9"/>',
  PRIMARY,
  20,
);

/**
 * Une ligne « champ » : pastille icône + libellé (petit gris) au-dessus
 * de la valeur (navy). Rendu en table pour la compat clients mail.
 */
function field(
  iconSrc: string,
  label: string,
  valueHtml: string,
  last = false,
): string {
  const pad = last ? "16px 0 0" : "16px 0";
  const rule = last ? "" : `border-bottom:1px solid ${RULE};`;
  return `
        <tr>
          <td style="padding:${pad};${rule}">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:middle;padding-right:16px;">
                  <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="width:44px;height:44px;background:${LIGHT};border-radius:12px;text-align:center;vertical-align:middle;">
                    <img src="${iconSrc}" width="20" height="20" alt="" style="vertical-align:middle;">
                  </td></tr></table>
                </td>
                <td style="vertical-align:middle;">
                  <div style="font-family:${SANS};font-size:11px;font-weight:700;color:${MUTED};letter-spacing:.05em;text-transform:uppercase;">${label}</div>
                  <div style="font-family:${SANS};font-size:16px;color:${NAVY_SOFT};line-height:1.4;margin-top:3px;">${valueHtml}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
}

/** Version HTML du template. */
export function contactEmailHtml(data: ContactEmailData): string {
  const { name, email, tel, praticiensLabel, message, submittedAt } = data;

  const messageHtml = message
    ? esc(message).replace(/\n/g, "<br>")
    : `<span style="color:${MUTED};">Aucun message</span>`;

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Nouvelle demande de contact — MediCare Pro</title>
</head>
<body style="margin:0;padding:0;background:${PAGE_BG};-webkit-text-size-adjust:100%;">
  <!-- Préheader (masqué) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Nouvelle demande de ${esc(name)} — ${esc(praticiensLabel)}</div>

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
                    <span style="display:inline-block;background:rgba(255,255,255,.16);border-radius:999px;padding:7px 14px;font-family:${SANS};font-size:12px;font-weight:600;color:#ffffff;">Nouvelle demande</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Intro -->
          <tr>
            <td style="padding:36px 40px 4px;">
              <h1 style="margin:0;font-family:${SANS};font-size:23px;font-weight:700;color:${NAVY};line-height:1.3;">Une demande vient d'arriver</h1>
              <p style="margin:9px 0 0;font-family:${SANS};font-size:14px;color:${BODY};line-height:1.6;">Reçue le ${esc(submittedAt)} via le formulaire de contact.</p>
            </td>
          </tr>

          <!-- Champs à icône -->
          <tr>
            <td style="padding:24px 40px 4px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${field(ICON_MAIL, "Contact", `<span style="font-weight:700;color:${NAVY};">${esc(name)}</span> &nbsp;·&nbsp; <a href="mailto:${esc(email)}" style="color:${PRIMARY};text-decoration:none;">${esc(email)}</a>`)}
                ${field(ICON_PHONE, "Téléphone", tel ? esc(tel) : `<span style="color:${MUTED};">Non renseigné</span>`)}
                ${field(ICON_USERS, "Taille du cabinet", `${esc(praticiensLabel)} praticien(s)`, true)}
              </table>
            </td>
          </tr>

          <!-- Message : encadré sobre, sans-serif, filet d'accent à gauche -->
          <tr>
            <td style="padding:28px 40px 4px;">
              <div style="font-family:${SANS};font-size:11px;font-weight:700;color:${MUTED};letter-spacing:.05em;text-transform:uppercase;margin-bottom:12px;">Son message</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${LIGHT};border-radius:14px;">
                <tr>
                  <td style="width:4px;background:${PRIMARY};border-radius:14px 0 0 14px;"></td>
                  <td style="padding:20px 24px;font-family:${SANS};font-size:15px;color:${NAVY_SOFT};line-height:1.7;">${messageHtml}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:30px 40px 4px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr><td style="border-radius:14px;background:${GRAD};background-color:${PRIMARY};box-shadow:0 8px 20px rgba(43,111,214,.28);">
                  <a href="mailto:${esc(email)}" style="display:inline-block;padding:15px 30px;font-family:${SANS};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:14px;">Répondre à ${esc(name)}&nbsp;&nbsp;&rarr;</a>
                </td></tr>
              </table>
              <p style="margin:13px 0 0;font-family:${SANS};font-size:12px;color:${MUTED};">Son adresse est en Reply-To : un simple « Répondre » suffit.</p>
            </td>
          </tr>

          <!-- Pied : badges de confiance -->
          <tr>
            <td style="padding:32px 40px 34px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${RULE};">
                <tr><td style="padding-top:24px;">
                  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                    <td style="background:${LIGHT};border-radius:999px;padding:8px 15px;font-family:${SANS};font-size:11px;font-weight:700;color:${PRIMARY};">Hébergé en France · HDS</td>
                    <td style="width:8px;"></td>
                    <td style="background:${LIGHT};border-radius:999px;padding:8px 15px;font-family:${SANS};font-size:11px;font-weight:700;color:${PRIMARY};">RGPD · Chiffré</td>
                  </tr></table>
                  <p style="margin:18px 0 0;font-family:${SANS};font-size:11px;color:${MUTED};line-height:1.6;">Email automatique du formulaire de contact de <a href="https://medicarepro.fr" style="color:${MUTED};">medicarepro.fr</a>.</p>
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

/** Version texte brut (repli pour les clients sans HTML). */
export function contactEmailText(data: ContactEmailData): string {
  const { name, email, tel, praticiensLabel, message, submittedAt } = data;
  return [
    "MediCare Pro — Nouvelle demande de contact",
    `Reçue le ${submittedAt}`,
    "",
    `Contact      ${name} · ${email}`,
    `Téléphone    ${tel || "Non renseigné"}`,
    `Cabinet      ${praticiensLabel} praticien(s)`,
    "",
    "Son message :",
    message || "(aucun message)",
    "",
    "— Répondez directement à ce message (adresse du visiteur en Reply-To).",
    "Hébergé en France · HDS — RGPD · Chiffré — medicarepro.fr",
  ].join("\n");
}
