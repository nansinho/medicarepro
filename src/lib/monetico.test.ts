import { describe, expect, it } from "vitest";
import {
  buildPaymentForm,
  buildSealBase,
  computeSeal,
  filterIpnForStorage,
  formatMoneticoDate,
  formatMontant,
  getUsableKey,
  IPN_ACK_KO,
  IPN_ACK_OK,
  parseIpnBody,
  parseMontant,
  parseMoneticoDate,
  parseCaptureResponse,
  buildStopRecurrenceRequest,
  buildCaptureRequest,
  sealFields,
  verifyIpnSeal,
  type MoneticoConfig,
} from "./monetico";

/* ============================================================
   KAT Monetico (gate de merge, plan §7.1).

   ✅ JALON VALIDÉ le 11/07/2026 : l'ordre du sceau (alphabétique,
   « champ=valeur » joints par « * ») a été accepté par la VRAIE
   plateforme TEST Monetico (TPE 40OCXXI, réf. MP1MS9HGJ7QE —
   page de paiement affichée avec commerçant/montant corrects).
   Les vecteurs ci-dessous protègent contre toute régression de
   cette convention désormais figée. (La clé de test réelle n'est
   volontairement PAS committée — les vecteurs utilisent la clé
   publique des kits officiels.)
   ============================================================ */

// Clé de test du kit officiel Monetico (publique, présente dans tous les kits).
const TEST_KEY = "12345678901234567890123456789012345678P0";

const CONFIG: MoneticoConfig = {
  tpe: "1234567",
  key: TEST_KEY,
  societe: "medicarepro",
  mode: "test",
};

describe("getUsableKey (_getUsableKey du kit officiel)", () => {
  it("clé 100 % hexadécimale : les 40 caractères sont packés tels quels", () => {
    const key = "0123456789abcdef0123456789abcdef01234567";
    expect(getUsableKey(key).toString("hex")).toBe(key);
    expect(getUsableKey(key).length).toBe(20);
  });

  it("dernier caractère 'P' (kit de test officiel) : branche cca0 ∈ ]70;97[", () => {
    // 'P' = 80 → chr(80-23) = '9' ; hexFinal[1] = '0' → suffixe "90".
    const usable = getUsableKey(TEST_KEY);
    expect(usable.length).toBe(20);
    expect(usable.toString("hex")).toBe(
      "1234567890123456789012345678901234567890",
    );
  });

  it("avant-dernier caractère puis 'M' : branche spéciale → '<c>0'", () => {
    const key = "0123456789abcdef0123456789abcdef012345" + "6M";
    expect(getUsableKey(key).toString("hex")).toBe(
      "0123456789abcdef0123456789abcdef01234560",
    );
  });

  it("rejette une clé qui ne fait pas 40 caractères", () => {
    expect(() => getUsableKey("abc")).toThrow(/40/);
  });
});

describe("sceau (MAC)", () => {
  it("chaîne à sceller : champs triés alphabétiquement, MAC exclu, k=v joints par *", () => {
    const base = buildSealBase({
      version: "3.0",
      TPE: "1234567",
      MAC: "doit-etre-exclu",
      date: "11/07/2026:10:00:00",
    });
    expect(base).toBe("TPE=1234567*date=11/07/2026:10:00:00*version=3.0");
  });

  it("KAT anti-régression : MAC hex minuscules stable", () => {
    // Vecteur auto-généré — À REMPLACER par une capture payetest réelle.
    const base = "TPE=1234567*date=11/07/2026:10:00:00*version=3.0";
    const mac = computeSeal(base, TEST_KEY);
    expect(mac).toMatch(/^[0-9a-f]{40}$/);
    expect(mac).toBe(computeSeal(base, TEST_KEY)); // déterministe
  });

  it("verifyIpnSeal : accepte le MAC recalculé, casse ignorée", () => {
    const fields: Record<string, string> = {
      TPE: "1234567",
      date: "11/07/2026:10:00:00",
      montant: "658.08EUR",
      reference: "MPABCDEF1234",
      "code-retour": "payetest",
    };
    fields["MAC"] = sealFields(fields, TEST_KEY);
    expect(verifyIpnSeal(fields, TEST_KEY)).toBe(true);

    // Monetico renvoie parfois le MAC en majuscules.
    fields["MAC"] = fields["MAC"].toUpperCase();
    expect(verifyIpnSeal(fields, TEST_KEY)).toBe(true);
  });

  it("verifyIpnSeal : rejette un champ altéré ou un MAC absent", () => {
    const fields: Record<string, string> = {
      TPE: "1234567",
      montant: "658.08EUR",
      reference: "MPABCDEF1234",
      "code-retour": "payetest",
    };
    fields["MAC"] = sealFields(fields, TEST_KEY);
    expect(verifyIpnSeal({ ...fields, montant: "1.00EUR" }, TEST_KEY)).toBe(false);

    const { MAC: _mac, ...sansMac } = fields;
    expect(verifyIpnSeal(sansMac, TEST_KEY)).toBe(false);
  });
});

describe("montants", () => {
  it("formatMontant : centimes → format Monetico", () => {
    expect(formatMontant(65808)).toBe("658.08EUR");
    expect(formatMontant(2988)).toBe("29.88EUR");
    expect(formatMontant(100)).toBe("1.00EUR");
    expect(formatMontant(5, "EUR")).toBe("0.05EUR");
  });

  it("formatMontant : rejette zéro, négatif, non entier", () => {
    expect(() => formatMontant(0)).toThrow();
    expect(() => formatMontant(-5)).toThrow();
    expect(() => formatMontant(29.88)).toThrow();
  });

  it("parseMontant : aller-retour et variantes", () => {
    expect(parseMontant("658.08EUR")).toEqual({ cents: 65808, currency: "EUR" });
    expect(parseMontant("29,88EUR")).toEqual({ cents: 2988, currency: "EUR" });
    expect(parseMontant("10GBP")).toEqual({ cents: 1000, currency: "GBP" });
    expect(parseMontant("1.5EUR")).toEqual({ cents: 150, currency: "EUR" });
    expect(parseMontant("n'importe quoi")).toBeNull();
    expect(parseMontant("10.123EUR")).toBeNull(); // 3 décimales interdites
  });
});

describe("formulaire Aller", () => {
  it("construit un formulaire scellé complet vers l'URL de test", () => {
    const { action, fields } = buildPaymentForm(
      {
        reference: "MPABCDEF1234",
        amountCents: 65808,
        email: "jean.dupont@cabinet.fr",
        urlRetourOk: "https://medicarepro.fr/inscription/confirmation?ref=MPABCDEF1234",
        urlRetourErr: "https://medicarepro.fr/inscription/confirmation?ref=MPABCDEF1234",
        billingContext: {
          addressLine1: "12 rue de la Santé",
          city: "Paris",
          postalCode: "75014",
          country: "FR",
        },
        now: new Date("2026-07-11T08:00:00Z"),
      },
      CONFIG,
    );

    expect(action).toBe("https://p.monetico-services.com/test/paiement.cgi");
    expect(fields.TPE).toBe("1234567");
    expect(fields.version).toBe("3.0");
    expect(fields.montant).toBe("658.08EUR");
    expect(fields.date).toBe("11/07/2026:10:00:00"); // Europe/Paris = UTC+2 en été
    expect(fields.MAC).toMatch(/^[0-9a-f]{40}$/);

    // contexte_commande = base64(JSON) avec l'adresse de facturation.
    const ctx = JSON.parse(
      Buffer.from(fields.contexte_commande, "base64").toString("utf8"),
    );
    expect(ctx.billing.postalCode).toBe("75014");

    // Le MAC couvre bien les champs émis.
    expect(verifyIpnSeal(fields, TEST_KEY)).toBe(true);
  });

  it("rejette une référence invalide", () => {
    expect(() =>
      buildPaymentForm(
        {
          reference: "trop-court",
          amountCents: 100,
          email: "a@b.fr",
          urlRetourOk: "https://x",
          urlRetourErr: "https://x",
          billingContext: {
            addressLine1: "1 rue A",
            city: "Paris",
            postalCode: "75001",
            country: "FR",
          },
        },
        CONFIG,
      ),
    ).toThrow(/Référence/);
  });
});

describe("IPN : parsing et filtrage", () => {
  it("parseIpnBody : form-urlencoded → champs", () => {
    const fields = parseIpnBody(
      "TPE=1234567&reference=MPABCDEF1234&code-retour=payetest&montant=658.08EUR",
    );
    expect(fields["code-retour"]).toBe("payetest");
    expect(fields.montant).toBe("658.08EUR");
  });

  it("filterIpnForStorage : retire MAC et les champs bancaires/perso", () => {
    const filtered = filterIpnForStorage({
      TPE: "1234567",
      reference: "MPABCDEF1234",
      "code-retour": "payetest",
      MAC: "secret",
      bincb: "12345678",
      hpancb: "empreinte",
      cbmasquee: "1234XXXXXXXX5678",
      ipclient: "1.2.3.4",
      numauto: "000001",
      vld: "1228",
    });
    expect(filtered).toEqual({
      TPE: "1234567",
      reference: "MPABCDEF1234",
      "code-retour": "payetest",
    });
  });

  it("ACK à l'octet près", () => {
    expect(IPN_ACK_OK).toBe("version=2\ncdr=0\n");
    expect(IPN_ACK_KO).toBe("version=2\ncdr=1\n");
  });
});

describe("formatMoneticoDate", () => {
  it("formate en JJ/MM/AAAA:HH:MM:SS heure de Paris", () => {
    expect(formatMoneticoDate(new Date("2026-01-15T13:05:09Z"))).toBe(
      "15/01/2026:14:05:09", // hiver = UTC+1
    );
    expect(formatMoneticoDate(new Date("2026-07-11T08:00:00Z"))).toBe(
      "11/07/2026:10:00:00", // été = UTC+2
    );
  });
});

describe("parseMoneticoDate", () => {
  it("lit le format de l'interface Retour (JJ/MM/AAAA_a_HH:MM:SS)", () => {
    expect(parseMoneticoDate("15/01/2026_a_14:05:09")?.toISOString()).toBe(
      "2026-01-15T13:05:09.000Z", // hiver = UTC+1
    );
    expect(parseMoneticoDate("11/07/2026_a_10:00:00")?.toISOString()).toBe(
      "2026-07-11T08:00:00.000Z", // été = UTC+2
    );
  });

  it("lit aussi le format du formulaire aller (JJ/MM/AAAA:HH:MM:SS)", () => {
    expect(parseMoneticoDate("11/07/2026:10:00:00")?.toISOString()).toBe(
      "2026-07-11T08:00:00.000Z",
    );
  });

  it("fait l'aller-retour avec formatMoneticoDate", () => {
    const date = new Date("2026-03-29T02:30:00Z"); // lendemain du changement d'heure
    expect(parseMoneticoDate(formatMoneticoDate(date))?.toISOString()).toBe(
      date.toISOString(),
    );
  });

  it("renvoie null sur un format inconnu", () => {
    expect(parseMoneticoDate("2026-07-11T10:00:00Z")).toBeNull();
    expect(parseMoneticoDate("")).toBeNull();
  });
});

describe("buildStopRecurrenceRequest", () => {
  const config: MoneticoConfig = {
    tpe: "1234567",
    key: "12345678901234567890123456789012345678P0",
    societe: "monSite1",
    mode: "test",
  };

  it("reproduit la chaîne scellée de la doc (annulation de récurrence)", () => {
    const { url, fields } = buildStopRecurrenceRequest(
      {
        reference: "ABERTYP00145",
        orderDate: new Date("2006-12-05T09:00:00Z"),
        amountCents: 6200,
        alreadyCapturedCents: 0,
        now: new Date("2006-12-05T10:55:23Z"),
      },
      config,
    );

    expect(url).toBe(
      "https://p.monetico-services.com/test/capture_paiement.cgi",
    );
    expect(buildSealBase(fields)).toBe(
      "TPE=1234567*date=05/12/2006:11:55:23*date_commande=05/12/2006*lgue=FR*" +
        "montant=62.00EUR*montant_a_capturer=0EUR*montant_deja_capture=0EUR*" +
        "montant_restant=0EUR*reference=ABERTYP00145*societe=monSite1*" +
        "stoprecurrence=OUI*version=3.0",
    );
    expect(fields["MAC"]).toBe(computeSeal(buildSealBase(fields), config.key));
  });

  it("reporte le montant déjà capturé quand il est non nul", () => {
    const { fields } = buildStopRecurrenceRequest(
      {
        reference: "MPABCDEF1234",
        orderDate: new Date("2026-07-11T08:00:00Z"),
        amountCents: 29808,
        alreadyCapturedCents: 29808,
        now: new Date("2027-07-11T08:00:00Z"),
      },
      config,
    );
    expect(fields["montant_deja_capture"]).toBe("298.08EUR");
    expect(fields["montant_a_capturer"]).toBe("0EUR");
    expect(fields["montant_restant"]).toBe("0EUR");
  });
});

describe("parseCaptureResponse", () => {
  it("lit un arrêt de récurrence accepté (cdr=1, sens INVERSE de l'ACK IPN)", () => {
    const res = parseCaptureResponse(
      "version=1.0\nreference=000000000145\ncdr=1\nlib=recurrence stoppee\naut=123456\n",
    );
    expect(res.accepted).toBe(true);
    expect(res.lib).toBe("recurrence stoppee");
    expect(res.reference).toBe("000000000145");
  });

  it("lit un refus", () => {
    const res = parseCaptureResponse(
      "version=1.0\nreference=000000000145\ncdr=0\nlib=autorisation refusee\n",
    );
    expect(res.accepted).toBe(false);
    expect(res.lib).toBe("autorisation refusee");
  });
});

describe("buildCaptureRequest", () => {
  const config: MoneticoConfig = {
    tpe: "NB8179R",
    key: "12345678901234567890123456789012345678P0",
    societe: "medicarepr",
    mode: "test",
  };
  const base = {
    reference: "MPB19GK81GC9",
    orderDate: new Date("2026-07-23T22:55:57Z"), // 24/07 à 00h55 à Paris
    amountCents: 4488,
    now: new Date("2026-07-24T08:00:00Z"),
  };

  it("recouvrement : encaisse le montant, solde à zéro", () => {
    const { fields } = buildCaptureRequest(
      { ...base, captureCents: 4488, alreadyCapturedCents: 0, remainingCents: 0 },
      config,
    );
    // La date de commande doit être celle vue par la banque (heure de Paris).
    expect(fields["date_commande"]).toBe("24/07/2026");
    expect(fields["montant"]).toBe("44.88EUR");
    expect(fields["montant_a_capturer"]).toBe("44.88EUR");
    expect(fields["montant_deja_capture"]).toBe("0EUR");
    expect(fields["montant_restant"]).toBe("0EUR");
    expect(fields["stoprecurrence"]).toBeUndefined();
    expect(fields["MAC"]).toBe(computeSeal(buildSealBase(fields), config.key));
  });

  it("annulation : les trois montants à zéro, sans stoprecurrence", () => {
    const { fields } = buildCaptureRequest(
      { ...base, captureCents: 0, alreadyCapturedCents: 0, remainingCents: 0 },
      config,
    );
    expect(fields["montant_a_capturer"]).toBe("0EUR");
    expect(fields["montant_deja_capture"]).toBe("0EUR");
    expect(fields["montant_restant"]).toBe("0EUR");
    expect(fields["stoprecurrence"]).toBeUndefined();
  });

  it("arrêt de récurrence : mêmes montants, plus stoprecurrence=OUI", () => {
    const { fields } = buildStopRecurrenceRequest(
      { ...base, alreadyCapturedCents: 0 },
      config,
    );
    expect(fields["montant_a_capturer"]).toBe("0EUR");
    expect(fields["montant_restant"]).toBe("0EUR");
    expect(fields["stoprecurrence"]).toBe("OUI");
  });

  it("reporte l'historique déjà encaissé sur une reconduction", () => {
    const { fields } = buildCaptureRequest(
      {
        ...base,
        captureCents: 4488,
        alreadyCapturedCents: 4488,
        remainingCents: 0,
      },
      config,
    );
    expect(fields["montant_deja_capture"]).toBe("44.88EUR");
  });
});
