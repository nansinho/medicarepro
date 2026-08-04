import { describe, expect, it } from "vitest";
import { paymentFailedEmail } from "./checkout-templates";

/* Ce message part au client dont la carte vient d'être refusée. Deux choses
   ne doivent JAMAIS bouger : il annonce la date jusqu'à laquelle l'accès est
   garanti (sinon le client croit avoir tout perdu), et il ne laisse pas
   entendre que ses dossiers patients sont menacés. */
describe("paymentFailedEmail", () => {
  const base = {
    adminFirstName: "Nans",
    cabinetName: "Cabinet Test",
    amountLabel: "29,88 €",
    graceUntilLabel: "18 août 2026",
  };

  it("porte le montant, le cabinet et la fin du délai de grâce", () => {
    const m = paymentFailedEmail({ ...base, attempt: 1 });
    expect(m.html).toContain("29,88 €");
    expect(m.html).toContain("Cabinet Test");
    expect(m.html).toContain("18 août 2026");
    expect(m.text).toContain("18 août 2026");
  });

  it("rassure sur les données patients et donne un contact", () => {
    const m = paymentFailedEmail({ ...base, attempt: 1 });
    expect(m.html).toContain("dossiers patients ne sont jamais touchés");
    expect(m.html).toContain("contact@medicarepro.fr");
  });

  it("durcit le sujet à partir du deuxième refus", () => {
    expect(paymentFailedEmail({ ...base, attempt: 1 }).subject).toContain(
      "a été refusé",
    );
    expect(paymentFailedEmail({ ...base, attempt: 2 }).subject).toContain(
      "toujours pas abouti",
    );
  });
});
