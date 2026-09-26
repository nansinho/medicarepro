import { describe, expect, it } from "vitest";
import {
  giftEndedEmail,
  giftInvitationEmail,
  giftReminderEmail,
  giftWelcomeEmail,
} from "@/lib/emails/gift-templates";

/* ============================================================
   Les emails de l'accès offert.

   Ce qu'on vérifie, c'est la phrase qui engage : un bénéficiaire sans carte
   ne doit JAMAIS lire qu'un prélèvement aura lieu, et un bénéficiaire avec
   carte doit TOUJOURS lire le montant et la date avant qu'il ait lieu.
   ============================================================ */

const LIEN = "https://medicarepro.fr/inscription?invitation=abc";
const APP = "https://app.medicarepro.fr/login";

describe("emails d'accès offert", () => {
  it("invitation sans carte : aucun prélèvement annoncé, le lien est présent", () => {
    const m = giftInvitationEmail({ months: 6, link: LIEN, expiresAtLabel: "25 novembre 2026", requireCard: false });
    expect(m.subject).toContain("6 mois");
    expect(m.html).toContain(LIEN);
    expect(m.text).toContain(LIEN);
    expect(m.text).toContain("Aucune carte bancaire n'est demandée");
    expect(m.text).not.toMatch(/démarre sur la carte/);
  });

  it("invitation avec carte : l'abonnement qui démarre est annoncé", () => {
    const m = giftInvitationEmail({ months: 3, link: LIEN, expiresAtLabel: "25 novembre 2026", requireCard: true });
    expect(m.text).toContain("démarre sur la carte enregistrée");
  });

  it("n'écrit jamais le motif interne de l'invitation", () => {
    const m = giftInvitationEmail({ months: 6, link: LIEN, expiresAtLabel: "25 novembre 2026", requireCard: false });
    expect(m.html.toLowerCase()).not.toContain("quiz");
  });

  it("échappe ce qui vient de la saisie du praticien", () => {
    const m = giftWelcomeEmail({
      adminFirstName: "<script>",
      cabinetName: "Cabinet \"Dupont\" & fils",
      months: 6,
      endsAtLabel: "26 mars 2027",
      requireCard: false,
      afterLabel: "Mensuel sans engagement, 29,88 € TTC par mois",
      loginUrl: APP,
    });
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;script&gt;");
  });

  it("rappel avec carte : montant et date du premier prélèvement", () => {
    const m = giftReminderEmail({
      adminFirstName: "Guilhaume",
      cabinetName: "Cabinet Lejeune",
      endsAtLabel: "26 mars 2027",
      daysBefore: 7,
      hasPaymentMethod: true,
      planLabel: "Mensuel sans engagement",
      amountLabel: "29,88 € TTC",
      loginUrl: APP,
    });
    expect(m.subject).toContain("démarre le 26 mars 2027");
    expect(m.text).toContain("29,88 € TTC, le 26 mars 2027");
  });

  it("rappel sans carte : ce qu'il faut faire, et ce qui arrive sinon", () => {
    const m = giftReminderEmail({
      adminFirstName: "Nastasya",
      cabinetName: "Cabinet G.",
      endsAtLabel: "26 décembre 2026",
      daysBefore: 2,
      hasPaymentMethod: false,
      planLabel: "Mensuel sans engagement",
      amountLabel: "29,88 € TTC",
      loginUrl: APP,
    });
    expect(m.text).toContain("Gérer mon abonnement");
    expect(m.text).toContain("lecture seule");
    expect(m.text).not.toContain("Premier prélèvement");
  });

  it("fin sans abonnement : rien n'est supprimé, et comment reprendre", () => {
    const m = giftEndedEmail({ adminFirstName: "N", cabinetName: "C", endedAtLabel: "26 décembre 2026", loginUrl: APP });
    expect(m.text).toContain("lecture seule");
    expect(m.text).toContain("Gérer mon abonnement");
  });

  it("aucun tiret cadratin dans le texte écrit pour le bénéficiaire", () => {
    const tous = [
      giftInvitationEmail({ months: 6, link: LIEN, expiresAtLabel: "x", requireCard: true }),
      giftInvitationEmail({ months: 6, link: LIEN, expiresAtLabel: "x", requireCard: false }),
      giftWelcomeEmail({ adminFirstName: "a", cabinetName: "b", months: 6, endsAtLabel: "x", requireCard: true, afterLabel: "y", loginUrl: APP }),
      giftReminderEmail({ adminFirstName: "a", cabinetName: "b", endsAtLabel: "x", daysBefore: 7, hasPaymentMethod: false, planLabel: "p", amountLabel: "m", loginUrl: APP }),
      giftEndedEmail({ adminFirstName: "a", cabinetName: "b", endedAtLabel: "x", loginUrl: APP }),
    ];
    for (const m of tous) {
      expect(m.subject).not.toContain("—");
      expect(m.text).not.toContain("—");
    }
  });
});
