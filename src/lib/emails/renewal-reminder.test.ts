import { describe, expect, it } from "vitest";
import { renewalReminderEmail } from "./checkout-templates";

describe("renewalReminderEmail", () => {
  const base = {
    adminFirstName: "Nans",
    cabinetName: "Cabinet Test",
    expiresAtLabel: "29 juillet 2027",
    amountLabel: "298,08 €",
  };

  it("adapte le sujet au nombre de jours restants", () => {
    expect(renewalReminderEmail({ ...base, daysBefore: 30 }).subject).toContain(
      "dans 30 jours",
    );
    expect(renewalReminderEmail({ ...base, daysBefore: 1 }).subject).toContain(
      "demain",
    );
    expect(renewalReminderEmail({ ...base, daysBefore: 0 }).subject).toContain(
      "aujourd'hui",
    );
  });

  it("contient la date d'échéance, le montant et le contact", () => {
    const m = renewalReminderEmail({ ...base, daysBefore: 7 });
    expect(m.html).toContain("29 juillet 2027");
    expect(m.html).toContain("298,08 €");
    expect(m.html).toContain("contact@medicarepro.fr");
    expect(m.text).toContain("29 juillet 2027");
  });

  it("passe en ton urgent à 3 jours et moins", () => {
    expect(renewalReminderEmail({ ...base, daysBefore: 3 }).html).toContain(
      "Échéance imminente",
    );
    expect(renewalReminderEmail({ ...base, daysBefore: 15 }).html).toContain(
      "Échéance à venir",
    );
  });
});
