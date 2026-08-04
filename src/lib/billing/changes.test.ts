import { describe, expect, it } from "vitest";
import {
  targetOf,
  payableFrom,
  isPayableNow,
  type SubscriptionChange,
} from "./changes";

/* ============================================================
   Fenêtre de paiement d'un changement d'abonnement.

   CE QUE CES TESTS PROTÈGENT, ET POURQUOI ÇA COMPTE EN ARGENT :

   Monetico ne modifie pas une commande récurrente en place. Un changement de
   formule ou de carte impose donc d'ouvrir une NOUVELLE commande, et le TPE
   récurrent fait repartir le cycle du jour de cette commande. Conséquence
   directe : un client mensuel qui règle son changement trois jours avant son
   terme offre trois jours à la banque, sans contrepartie et sans le savoir.

   La règle qui l'en protège tient en trois lignes de `payableFrom`, et rien
   dans l'interface ne la rappelle à qui la modifierait. D'où ces tests.

   L'annuel obéit à la règle inverse (paiement unique, période AJOUTÉE au
   terme en cours) : l'y soumettre bloquerait un renouvellement anticipé
   parfaitement légitime.
   ============================================================ */

const DAY = 86_400_000;

function change(over: Partial<SubscriptionChange> = {}): SubscriptionChange {
  return {
    id: "c0000000-0000-4000-8000-000000000001",
    subscription_id: "s0000000-0000-4000-8000-000000000001",
    app_cabinet_id: "cmrg49kym001pizc12p1cnkg5",
    kind: "plan_change",
    target_plan: "MONTHLY",
    target_extra_collaborators: 2,
    target_amount_cents: 5988,
    status: "scheduled",
    effective_at: new Date(Date.now() + 10 * DAY).toISOString(),
    reason: null,
    created_at: new Date().toISOString(),
    ...over,
  };
}

const SUB = {
  plan: "MONTHLY" as const,
  extra_collaborators: 0,
  status: "active",
};

describe("targetOf", () => {
  it("reconduit la formule en cours pour un changement de carte", () => {
    /* Un changement de carte ne change QUE le moyen de paiement. Y glisser une
       formule différente ferait payer autre chose que ce qui a été annoncé. */
    expect(targetOf(change({ kind: "card_update" }), SUB)).toEqual({
      plan: "MONTHLY",
      extraCollaborators: 0,
    });
  });

  it("suit la cible enregistrée pour un changement de formule", () => {
    expect(
      targetOf(
        change({ target_plan: "ANNUAL", target_extra_collaborators: 3 }),
        SUB,
      ),
    ).toEqual({ plan: "ANNUAL", extraCollaborators: 3 });
  });

  it("ne vise aucune formule pour une résiliation", () => {
    expect(
      targetOf(
        change({
          kind: "cancel",
          target_plan: null,
          target_extra_collaborators: null,
        }),
        SUB,
      ),
    ).toBeNull();
  });
});

describe("payableFrom", () => {
  it("interdit de régler un mensuel avant son terme", () => {
    const c = change();
    expect(payableFrom(c, SUB)?.toISOString()).toBe(c.effective_at);
    expect(isPayableNow(c, SUB)).toBe(false);
  });

  it("ouvre le paiement une fois le terme atteint", () => {
    const c = change({
      effective_at: new Date(Date.now() - DAY).toISOString(),
    });
    expect(isPayableNow(c, SUB)).toBe(true);
  });

  it("laisse régler un annuel tout de suite : la période s'ajoute au terme", () => {
    const c = change({ target_plan: "ANNUAL", target_extra_collaborators: 0 });
    expect(isPayableNow(c, SUB)).toBe(true);
  });

  it("ouvre le paiement immédiatement en cas d'impayé", () => {
    /* L'échéance est due : la nouvelle carte est là pour la régler, et
       attendre le terme reviendrait à retarder un encaissement déjà en
       retard. */
    const c = change({ kind: "card_update" });
    expect(isPayableNow(c, { ...SUB, status: "past_due" })).toBe(true);
    expect(isPayableNow(c, { ...SUB, status: "suspended" })).toBe(true);
  });

  it("n'ouvre aucun paiement pour une résiliation", () => {
    const c = change({
      kind: "cancel",
      target_plan: null,
      target_extra_collaborators: null,
    });
    expect(payableFrom(c, SUB)).toBeNull();
    expect(isPayableNow(c, SUB)).toBe(false);
  });

  it("garde la règle du mensuel même quand la cible est un mensuel plus cher", () => {
    // Régression : un test de montant ne doit pas faire oublier la fenêtre.
    const c = change({ target_extra_collaborators: 20 });
    expect(isPayableNow(c, SUB)).toBe(false);
  });
});
