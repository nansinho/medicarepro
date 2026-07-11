/* ============================================================
   Jours ouvrés TARGET (calendrier de fermeture TARGET2/T2 de
   l'Eurosystème) — les prélèvements SEPA ne peuvent être réglés
   qu'un jour où TARGET est ouvert.

   Jours de fermeture : samedis, dimanches, 1er janvier,
   Vendredi saint, lundi de Pâques, 1er mai, 25 et 26 décembre.
   ⚠️ Les autres jours fériés FRANÇAIS (14 juillet, 11 novembre…)
   sont des jours ouvrés TARGET.

   Tous les calculs se font sur la date CIVILE en Europe/Paris
   (via Intl, sans dépendance date). Les fonctions renvoient un
   Date à minuit UTC du jour civil obtenu : comme Paris est en
   avance sur UTC (UTC+1/+2), ce Date retombe sur le même jour
   civil parisien — les résultats sont stables si on les réinjecte.
   ============================================================ */

type Ymd = { year: number; month: number; day: number };

/** Formatteur mémoïsé : date civile en Europe/Paris au format AAAA-MM-JJ. */
const PARIS_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function assertValidDate(date: Date, label: string): void {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error(`${label} : date invalide.`);
  }
}

/** Date civile (année/mois/jour) de l'instant `date` en Europe/Paris. */
export function parisYmd(date: Date): Ymd {
  assertValidDate(date, "parisYmd");
  const [year, month, day] = PARIS_FORMATTER.format(date).split("-").map(Number);
  return { year, month, day };
}

/** Jour civil → Date à minuit UTC (même jour civil vu de Paris). */
function ymdToDate({ year, month, day }: Ymd): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

/** Décale un jour civil de `days` jours calendaires (via Date.UTC, sans DST). */
function shiftDays(ymd: Ymd, days: number): Ymd {
  const shifted = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/** Jour de semaine du jour civil : 0 = dimanche … 6 = samedi. */
function weekdayOf(ymd: Ymd): number {
  return ymdToDate(ymd).getUTCDay();
}

/**
 * Dimanche de Pâques (calendrier grégorien) — algorithme de
 * Meeus/Jones/Butcher, forme non conditionnelle dérivée de Gauss.
 */
export function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = mars, 4 = avril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

/** Jours de fermeture TARGET de l'année (hors week-ends), clés « M-J ». */
const closingDaysCache = new Map<number, Set<string>>();

function targetClosingDays(year: number): Set<string> {
  const cached = closingDaysCache.get(year);
  if (cached) return cached;

  const easter = easterSunday(year);
  const easterYmd: Ymd = { year, month: easter.month, day: easter.day };
  const goodFriday = shiftDays(easterYmd, -2); // Vendredi saint
  const easterMonday = shiftDays(easterYmd, 1); // lundi de Pâques

  const days = new Set<string>([
    "1-1", // jour de l'an
    `${goodFriday.month}-${goodFriday.day}`,
    `${easterMonday.month}-${easterMonday.day}`,
    "5-1", // fête du travail
    "12-25", // Noël
    "12-26", // lendemain de Noël
  ]);
  closingDaysCache.set(year, days);
  return days;
}

function isBusinessYmd(ymd: Ymd): boolean {
  const weekday = weekdayOf(ymd);
  if (weekday === 0 || weekday === 6) return false;
  return !targetClosingDays(ymd.year).has(`${ymd.month}-${ymd.day}`);
}

/** L'instant `date` tombe-t-il un jour ouvré TARGET (vu d'Europe/Paris) ? */
export function isTargetBusinessDay(date: Date): boolean {
  return isBusinessYmd(parisYmd(date));
}

/** Premier jour ouvré TARGET STRICTEMENT APRÈS `date` (minuit UTC). */
export function nextTargetBusinessDay(date: Date): Date {
  let ymd = shiftDays(parisYmd(date), 1);
  while (!isBusinessYmd(ymd)) ymd = shiftDays(ymd, 1);
  return ymdToDate(ymd);
}

/**
 * Décale `date` de `n` jours ouvrés TARGET (n négatif = recul).
 * n = 0 renvoie le jour civil de `date` tel quel (même non ouvré).
 * Le résultat est toujours un jour ouvré dès que n ≠ 0.
 */
export function addTargetBusinessDays(date: Date, n: number): Date {
  if (!Number.isInteger(n)) {
    throw new Error("addTargetBusinessDays : n doit être un entier.");
  }
  let ymd = parisYmd(date);
  const step = n >= 0 ? 1 : -1;
  let remaining = Math.abs(n);
  while (remaining > 0) {
    ymd = shiftDays(ymd, step);
    if (isBusinessYmd(ymd)) remaining -= 1;
  }
  return ymdToDate(ymd);
}

/**
 * Date d'échéance du prélèvement de renouvellement : premier jour
 * ouvré TARGET ≥ (fin de période − (cutoffDays + 3) jours ouvrés),
 * soit « fin de période − 5 jours ouvrés » avec le défaut.
 *
 * cutoffDays = délai de remise à la banque (Core : D−2 ouvrés) ;
 * les 3 jours ouvrés supplémentaires sont la marge opérationnelle
 * pour encaisser AVANT l'expiration de l'abonnement (rejets,
 * remise en retard…).
 */
export function computeDueDate(currentPeriodEnd: Date, cutoffDays = 2): Date {
  if (!Number.isInteger(cutoffDays) || cutoffDays < 0) {
    throw new Error("computeDueDate : cutoffDays doit être un entier ≥ 0.");
  }
  const margin = cutoffDays + 3;
  // Reculer de `margin` jours ouvrés atterrit déjà sur un jour ouvré ;
  // la normalisation « ≥ » ci-dessous n'est qu'une ceinture de sécurité.
  let ymd = parisYmd(addTargetBusinessDays(currentPeriodEnd, -margin));
  while (!isBusinessYmd(ymd)) ymd = shiftDays(ymd, 1);
  return ymdToDate(ymd);
}
