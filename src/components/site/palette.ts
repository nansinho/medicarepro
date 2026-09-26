import type { Accent, MockupKindKey } from "@/lib/cms/sections.schema";

/* ============================================================
   Une couleur par module, reprise du logo : agenda bleu, bilans
   turquoise, orthèses violet, facturation ambre, comptabilité
   vert, portail bleu ciel, sécurité indigo. `c` = encre lisible
   sur blanc (texte, icône), `t` = fond doux assorti.
   ============================================================ */

export const ACCENTS: Record<Accent, { c: string; t: string }> = {
  blue: { c: "var(--brand-blue)", t: "var(--tint-blue)" },
  teal: { c: "var(--brand-teal-ink)", t: "var(--tint-teal)" },
  violet: { c: "var(--brand-violet)", t: "var(--tint-violet)" },
  amber: { c: "var(--brand-amber-ink)", t: "var(--tint-amber)" },
  green: { c: "var(--brand-green-ink)", t: "#e5f7ea" },
  sky: { c: "#1b7f9c", t: "var(--tint-sky)" },
  indigo: { c: "var(--brand-indigo)", t: "#e8e8f6" },
};

/** Couleur de module d'un écran du logiciel. */
export const ACCENT_BY_MOCKUP: Record<MockupKindKey, Accent> = {
  agenda: "blue",
  bilan: "teal",
  bilanChute: "teal",
  bilanPosturo: "teal",
  invoice: "amber",
  vitale: "amber",
  accounting: "green",
  stats: "green",
  signature: "violet",
  ai: "violet",
  portal: "sky",
  pwa: "sky",
  consultation: "blue",
};

/** Ancre de section (menus « Le logiciel ») par écran. */
export const ANCHOR_BY_MOCKUP: Partial<Record<MockupKindKey, string>> = {
  agenda: "agenda",
  bilan: "bilans",
  invoice: "facturation",
  accounting: "comptabilite",
  signature: "signature",
  pwa: "mobile",
  vitale: "carte-vitale",
  ai: "ia",
  portal: "portail-patient",
  stats: "statistiques",
};

/** Rotation des couleurs pour une suite de cartes sans module. */
export const CYCLE: Accent[] = ["blue", "teal", "violet", "amber", "green", "sky"];

export function accent(a: Accent) {
  return ACCENTS[a];
}
