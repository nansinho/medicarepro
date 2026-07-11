import { describe, expect, it } from "vitest";
import {
  addTargetBusinessDays,
  computeDueDate,
  easterSunday,
  isTargetBusinessDay,
  nextTargetBusinessDay,
} from "./business-days";

/* ============================================================
   Tests du calendrier TARGET (jours ouvrés SEPA, Europe/Paris).
   Les instants de test sont pris à midi UTC : Paris étant en
   avance sur UTC, midi UTC = après-midi à Paris, même jour civil.
   ============================================================ */

/** Instant à `h` h UTC du jour civil donné. */
const utc = (y: number, m: number, d: number, h = 12) =>
  new Date(Date.UTC(y, m - 1, d, h));

/** Jour civil AAAA-MM-JJ d'un Date renvoyé par la lib (minuit UTC). */
const day = (date: Date) => date.toISOString().slice(0, 10);

describe("easterSunday (algorithme de Meeus/Jones/Butcher)", () => {
  it("Pâques 2026 = dimanche 5 avril", () => {
    expect(easterSunday(2026)).toEqual({ month: 4, day: 5 });
  });

  it("Pâques 2024 = 31 mars, Pâques 2025 = 20 avril", () => {
    expect(easterSunday(2024)).toEqual({ month: 3, day: 31 });
    expect(easterSunday(2025)).toEqual({ month: 4, day: 20 });
  });
});

describe("isTargetBusinessDay", () => {
  it("refuse les week-ends", () => {
    expect(isTargetBusinessDay(utc(2026, 7, 11))).toBe(false); // samedi
    expect(isTargetBusinessDay(utc(2026, 7, 12))).toBe(false); // dimanche
    expect(isTargetBusinessDay(utc(2026, 7, 13))).toBe(true); // lundi
  });

  it("refuse les jours de fermeture TARGET 2026", () => {
    expect(isTargetBusinessDay(utc(2026, 1, 1))).toBe(false); // jour de l'an (jeudi)
    expect(isTargetBusinessDay(utc(2026, 4, 3))).toBe(false); // Vendredi saint
    expect(isTargetBusinessDay(utc(2026, 4, 6))).toBe(false); // lundi de Pâques
    expect(isTargetBusinessDay(utc(2026, 5, 1))).toBe(false); // 1er mai (vendredi)
    expect(isTargetBusinessDay(utc(2026, 12, 25))).toBe(false); // Noël
  });

  it("fêtes mobiles d'autres années (Pâques 2024 = 31 mars)", () => {
    expect(isTargetBusinessDay(utc(2024, 3, 29))).toBe(false); // Vendredi saint 2024
    expect(isTargetBusinessDay(utc(2024, 4, 1))).toBe(false); // lundi de Pâques 2024
    expect(isTargetBusinessDay(utc(2025, 12, 26))).toBe(false); // 26 déc 2025 (vendredi)
  });

  it("accepte les jours ouvrés ordinaires", () => {
    expect(isTargetBusinessDay(utc(2026, 4, 2))).toBe(true); // jeudi saint
    expect(isTargetBusinessDay(utc(2026, 4, 7))).toBe(true); // mardi après Pâques
  });

  it("le 14 juillet est OUVRÉ pour TARGET (férié français seulement)", () => {
    expect(isTargetBusinessDay(utc(2026, 7, 14))).toBe(true); // mardi
  });

  it("évalue le jour civil PARISIEN, pas le jour UTC", () => {
    // 23h30 UTC le 5 avril = 1h30 le 6 avril à Paris → lundi de Pâques.
    expect(isTargetBusinessDay(new Date("2026-04-05T23:30:00Z"))).toBe(false);
    // 23h30 UTC le 7 avril = 8 avril à Paris → mercredi ouvré.
    expect(isTargetBusinessDay(new Date("2026-04-07T23:30:00Z"))).toBe(true);
  });
});

describe("nextTargetBusinessDay (strictement après)", () => {
  it("saute le pont de Pâques 2026 : jeudi 2 avril → mardi 7 avril", () => {
    expect(day(nextTargetBusinessDay(utc(2026, 4, 2)))).toBe("2026-04-07");
  });

  it("depuis un jour ouvré, renvoie le lendemain ouvré", () => {
    expect(day(nextTargetBusinessDay(utc(2026, 4, 8)))).toBe("2026-04-09");
  });

  it("saute 1er mai (vendredi) + week-end : jeudi 30 avril → lundi 4 mai", () => {
    expect(day(nextTargetBusinessDay(utc(2026, 4, 30)))).toBe("2026-05-04");
  });

  it("saute Noël 2026 (25 = vendredi, 26 = samedi) : 24 déc → 28 déc", () => {
    expect(day(nextTargetBusinessDay(utc(2026, 12, 24)))).toBe("2026-12-28");
  });
});

describe("addTargetBusinessDays", () => {
  it("avance en sautant fermetures et week-ends : 1er avril + 3 = 8 avril", () => {
    expect(day(addTargetBusinessDays(utc(2026, 4, 1), 3))).toBe("2026-04-08");
  });

  it("recule : 10 avril − 5 jours ouvrés = 1er avril (pont de Pâques sauté)", () => {
    expect(day(addTargetBusinessDays(utc(2026, 4, 10), -5))).toBe("2026-04-01");
  });

  it("n = 0 : renvoie le jour civil tel quel, même non ouvré", () => {
    expect(day(addTargetBusinessDays(utc(2026, 4, 5), 0))).toBe("2026-04-05");
  });

  it("refuse un n non entier", () => {
    expect(() => addTargetBusinessDays(utc(2026, 4, 1), 1.5)).toThrow();
  });
});

describe("computeDueDate (échéance = fin de période − 5 jours ouvrés par défaut)", () => {
  it("fin de période vendredi 10 avril 2026 → échéance mercredi 1er avril", () => {
    // Recul de 5 ouvrés : 9, 8, 7 avril, [pont de Pâques], 2, 1er avril.
    expect(day(computeDueDate(utc(2026, 4, 10)))).toBe("2026-04-01");
  });

  it("le 14 juillet compte comme ouvré : lundi 20 juillet → lundi 13 juillet", () => {
    expect(day(computeDueDate(utc(2026, 7, 20)))).toBe("2026-07-13");
  });

  it("cutoffDays = 0 → recul de 3 jours ouvrés seulement", () => {
    expect(day(computeDueDate(utc(2026, 4, 10), 0))).toBe("2026-04-07");
  });

  it("refuse un cutoffDays négatif", () => {
    expect(() => computeDueDate(utc(2026, 4, 10), -1)).toThrow();
  });
});
