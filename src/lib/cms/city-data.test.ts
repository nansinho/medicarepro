import { describe, expect, it } from "vitest";
import { cityLabel, cityTitle, densite, formatDecimal, formatInt } from "./city-data";

describe("cityTitle", () => {
  it("vise « logiciel podologue + ville », marque comprise", () => {
    expect(cityTitle("à Lyon", "69")).toBe("Logiciel podologue à Lyon | MediCare Pro");
    expect(cityTitle("au Havre", "76")).toBe("Logiciel podologue au Havre | MediCare Pro");
  });
  it("précise le département d'un homonyme", () => {
    expect(cityTitle("à Saint-Denis", "974", true)).toBe("Logiciel podologue à Saint-Denis (974) | MediCare Pro");
  });
  it("retire la marque plutôt que de dépasser 60 caractères", () => {
    const t = cityTitle("à Saint-Germain-des-Fossés-sur-Allier", "03");
    expect(t.length).toBeLessThanOrEqual(60);
    expect(t).not.toContain("MediCare Pro");
  });
});

describe("cityLabel", () => {
  it("n'ajoute le département qu'aux homonymes", () => {
    expect(cityLabel("Tarbes", "65")).toBe("Tarbes");
    expect(cityLabel("Saint-Denis", "93", true)).toBe("Saint-Denis (93)");
  });
});

describe("chiffres", () => {
  it("calcule la densité pour 10 000 habitants à une décimale", () => {
    expect(densite(20, 44_399)).toBe(4.5);
    expect(densite(3, 0)).toBeNull();
  });
  it("formate à la française", () => {
    expect(formatInt(519127)).toBe("519\u202f127");
    expect(formatDecimal(2.7)).toBe("2,7");
    expect(formatDecimal(1)).toBe("1");
  });
});
