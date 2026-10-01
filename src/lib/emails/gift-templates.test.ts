import { describe, expect, it } from "vitest";
import {
  giftEndedEmail,
  giftInvitationEmail,
  giftReminderEmail,
  giftWelcomeEmail,
} from "@/lib/emails/gift-templates";

/* ============================================================
   Les emails de l'accès offert.

   Ce qu'on vérifie, c'est la phrase qui engage : un bénéficiaire ne doit
   JAMAIS lire qu'une carte lui sera demandée ou qu'un prélèvement aura lieu
   sans qu'il l'ait choisi. Seul celui qui a enregistré lui-même un moyen de
   paiement lit, avant l'échéance, le montant et la date du prélèvement.
   ============================================================ */

const LIEN = "https://medicarepro.fr/inscription?invitation=abc";
const APP = "https://app.medicarepro.fr/login";

describe("emails d'accès offert", () => {
  it("invitation : aucune carte, aucun prélèvement annoncé, le lien est présent", () => {
    const m = giftInvitationEmail({ months: 6, link: LIEN, expiresAtLabel: "25 novembre 2026" });
    expect(m.subject).toContain("6 mois");
    expect(m.html).toContain(LIEN);
    expect(m.text).toContain(LIEN);
    expect(m.text).toContain("Aucune carte bancaire n'est demandée");
    expect(m.text).toContain("Carte bancaire : non demandée");
    expect(m.text).not.toMatch(/démarre sur la carte|prélèvement/i);
  });

  it("ouverture de l'accès : aucune carte, aucun prélèvement annoncé", () => {
    const m = giftWelcomeEmail({
      adminFirstName: "Nathan",
      cabinetName: "Cabinet Varon",
      months: 1,
      endsAtLabel: "30 octobre 2026",
      loginUrl: APP,
    });
    expect(m.text).toContain("Aucune carte bancaire n'est demandée");
    expect(m.text).toContain("abonnement à choisir");
    expect(m.text).toContain(APP);
    expect(m.text).not.toMatch(/démarre sur la carte|prélèvement/i);
  });

  it("n'écrit jamais le motif interne de l'invitation", () => {
    const m = giftInvitationEmail({ months: 6, link: LIEN, expiresAtLabel: "25 novembre 2026" });
    expect(m.html.toLowerCase()).not.toContain("quiz");
  });

  it("échappe ce qui vient de la saisie du praticien", () => {
    const m = giftWelcomeEmail({
      adminFirstName: "<script>",
      cabinetName: "Cabinet \"Dupont\" & fils",
      months: 6,
      endsAtLabel: "26 mars 2027",
      loginUrl: APP,
    });
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;script&gt;");
  });

  it("rappel, carte ajoutée par le bénéficiaire : montant et date du premier prélèvement", () => {
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
      giftInvitationEmail({ months: 6, link: LIEN, expiresAtLabel: "x" }),
      giftWelcomeEmail({ adminFirstName: "a", cabinetName: "b", months: 6, endsAtLabel: "x", loginUrl: APP }),
      giftReminderEmail({ adminFirstName: "a", cabinetName: "b", endsAtLabel: "x", daysBefore: 7, hasPaymentMethod: true, planLabel: "p", amountLabel: "m", loginUrl: APP }),
      giftReminderEmail({ adminFirstName: "a", cabinetName: "b", endsAtLabel: "x", daysBefore: 7, hasPaymentMethod: false, planLabel: "p", amountLabel: "m", loginUrl: APP }),
      giftEndedEmail({ adminFirstName: "a", cabinetName: "b", endedAtLabel: "x", loginUrl: APP }),
    ];
    for (const m of tous) {
      expect(m.subject).not.toContain("—");
      expect(m.text).not.toContain("—");
    }
  });
});
