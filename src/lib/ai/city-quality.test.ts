import { describe, expect, it } from "vitest";
import type { CityLocalData } from "@/lib/cms/city-data";
import {
  allowedNumbers,
  answerKey,
  checkCityPage,
  extractNumbers,
  jaccard,
  shingles,
  type CityPageDraft,
  type QualityContext,
} from "./city-quality";

const DATA: CityLocalData = {
  insee: "65440",
  population: 42_000,
  podologues: 12,
  podologuesLiberaux: 11,
  densite: 2.9,
  departement: { code: "65", nom: "Hautes-Pyrénées", podologues: 40, population: 230_000, densite: 1.7 },
  france: { podologues: 15_062, population: 68_000_000, densite: 2.2 },
  codesPostaux: ["65000"],
  sources: { annuaireSante: "2026-09-26", population: "INSEE" },
};

const long = (s: string, n: number) => (s + " ").repeat(Math.ceil(n / (s.length + 1))).trim();

function page(overrides: Partial<CityPageDraft> = {}): CityPageDraft {
  return {
    seo_title: "Logiciel podologue à Tarbes | MediCare Pro",
    seo_description:
      "À Tarbes, 12 pédicures-podologues exercent. MediCare Pro réunit dossiers, bilans, facturation et agenda dans un logiciel hébergé en France.",
    h1: "Le logiciel des pédicures-podologues de Tarbes",
    content: {
      intro: `À Tarbes, 12 pédicures-podologues exercent, soit 2,9 pour 10 000 habitants. ${long("Le cabinet gagne du temps.", 140)}`,
      contexte_local: long("Tarbes et sa patientèle demandent un suivi régulier des pieds fragiles.", 470),
      benefices: long("Les bilans se remplissent en consultation et la facture part seule.", 370),
      meta_description: "Logiciel pour podologues à Tarbes.",
    },
    faq: [
      { q: "Combien de podologues exercent à Tarbes ?", a: "12, dont 11 en libéral." },
      { q: "Le logiciel convient-il aux cabinets de Tarbes ?", a: "Oui, il fonctionne en ligne." },
      { q: "Mes données sont-elles hébergées en France ?", a: "Oui, chez un hébergeur certifié HDS." },
      { q: "Peut-on démarrer depuis Tarbes sans déplacement ?", a: "Oui, à distance, à partir de 24,84 € par mois." },
    ],
    ...overrides,
  };
}

function ctx(others: QualityContext["others"] = []): QualityContext {
  return { cityName: "Tarbes", deptName: "Hautes-Pyrénées", data: DATA, others };
}

describe("extractNumbers", () => {
  it("lit les milliers séparés par des espaces et les décimales à virgule", () => {
    expect(extractNumbers("42 000 habitants, 2,9 pour 10\u202f000 et 24,84 €")).toEqual(["42000", "2,9", "10000", "24,84"]);
  });
  it("ramène « 4,0 » à « 4 »", () => {
    expect(extractNumbers("4,0")).toEqual(["4"]);
  });
});

describe("allowedNumbers", () => {
  it("accepte les données de la ville, du département, de la France et les faits produit", () => {
    const set = allowedNumbers(DATA);
    for (const n of ["42000", "12", "11", "2,9", "40", "230000", "1,7", "65", "15062", "2,2", "65000", "13", "24,84"]) {
      expect(set.has(n), n).toBe(true);
    }
  });
  it("accepte le chiffre des départements corses", () => {
    const set = allowedNumbers({ ...DATA, departement: { ...DATA.departement, code: "2A" } });
    expect(set.has("2")).toBe(true);
  });
});

describe("checkCityPage", () => {
  it("valide une page conforme", () => {
    const r = checkCityPage(page(), ctx());
    expect(r.issues).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("refuse un chiffre qui ne vient pas des données", () => {
    const r = checkCityPage(page({ h1: "Les 35 podologues de Tarbes" }), ctx());
    expect(r.issues.map((i) => i.code)).toContain("unknown_number");
  });

  it("refuse le tiret cadratin", () => {
    const p = page();
    p.content.benefices = `${p.content.benefices} Un gain de temps — enfin.`;
    expect(checkCityPage(p, ctx()).issues.map((i) => i.code)).toContain("dash");
  });

  it("exige la ville et le mot-clé dans le titre et le H1", () => {
    const codes = checkCityPage(page({ seo_title: "Logiciel de cabinet | MediCare Pro", h1: "Un logiciel pour Tarbes" }), ctx()).issues.map(
      (i) => i.code,
    );
    expect(codes).toEqual(expect.arrayContaining(["title_city", "title_keyword", "h1_keyword"]));
  });

  it("exige au moins trois questions de FAQ qui citent la ville", () => {
    const p = page();
    p.faq = p.faq.map((f) => ({ q: f.q.replace("Tarbes", "votre ville"), a: f.a }));
    expect(checkCityPage(p, ctx()).issues.map((i) => i.code)).toContain("faq_local");
  });

  it("refuse un H1 d'intention patient (sans « logiciel »)", () => {
    expect(checkCityPage(page({ h1: "Pédicure-podologue à Tarbes : un cabinet bien suivi" }), ctx()).issues.map((i) => i.code)).toContain("h1_keyword");
  });

  it("refuse une question de prix, réservée à la page Tarifs", () => {
    const p = page();
    p.faq[2] = { q: "Combien coûte MediCare Pro ?", a: "24,84 € par mois." };
    expect(checkCityPage(p, ctx()).issues.map((i) => i.code)).toContain("faq_price");
  });

  it("ne prend pas « écoute » pour une question de prix", () => {
    const p = page();
    p.faq[2] = { q: "Le support est-il à l'écoute ?", a: "Oui, 7j/7 par chat." };
    expect(checkCityPage(p, ctx()).issues.map((i) => i.code)).not.toContain("faq_price");
  });

  it("refuse un titre déjà pris par une autre ville", () => {
    const other = { slug: "pau", seo_title: page().seo_title, h1: "x", seo_description: "y", shingles: new Set<string>() };
    expect(checkCityPage(page(), ctx([other])).issues.map((i) => i.code)).toContain("duplicate_title");
  });

  it("refuse un texte recopié d'une autre ville, même avec un autre nom", () => {
    const copy = JSON.parse(JSON.stringify(page()).replaceAll("Tarbes", "Pau")) as CityPageDraft;
    const other = { slug: "pau", seo_title: copy.seo_title, h1: copy.h1, seo_description: copy.seo_description, shingles: shingles(copy, ["Pau"]) };
    const r = checkCityPage(page(), ctx([other]));
    expect(r.closestSlug).toBe("pau");
    expect(r.issues.map((i) => i.code)).toContain("too_similar");
  });
});

describe("réponses de FAQ", () => {
  it("refuse une réponse reprise mot pour mot d'une autre ville", () => {
    const answers = new Set(page().faq.map((f) => answerKey(f.a)));
    const other = { slug: "pau", seo_title: "a", h1: "b", seo_description: "c", shingles: new Set<string>(), faqAnswers: answers };
    expect(checkCityPage(page(), ctx([other])).issues.map((i) => i.code)).toContain("duplicate_faq_answer");
  });
});

describe("jaccard", () => {
  it("vaut 1 pour deux ensembles identiques et 0 sans intersection", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["a", "b"]))).toBe(1);
    expect(jaccard(new Set(["a"]), new Set(["b"]))).toBe(0);
  });
});
