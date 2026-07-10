/**
 * Formats d'affichage des valeurs numériques du CMS.
 * Les prix sont stockés en nombres (29.88) et rendus à la française,
 * à l'identique des anciennes chaînes codées en dur ("29,88").
 */

/** Prix en euros : virgule décimale, entiers sans décimales ("285", "24,84"). */
export function formatPrice(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(".", ",");
}
