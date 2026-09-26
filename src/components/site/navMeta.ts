import type { IconKey } from "@/lib/cms/sections.schema";

/* Pastille des entrées de menu : icône + couleur de module, choisies par
   route (les menus du CMS ne portent que libellé et lien). Une route
   inconnue retombe sur la pastille bleue générique. */
type Meta = { icon: IconKey; c: string; t: string };

const BLUE: Meta = { icon: "Grid", c: "var(--brand-blue)", t: "var(--tint-blue)" };

const BY_PATH: Record<string, Meta> = {
  "/fonctionnalites": BLUE,
  "/fonctionnalites#agenda": { icon: "Calendar", c: "var(--brand-blue)", t: "var(--tint-blue)" },
  "/bilans": { icon: "Foot", c: "var(--brand-teal-ink)", t: "var(--tint-teal)" },
  "/fonctionnalites#facturation": { icon: "Invoice", c: "var(--brand-amber-ink)", t: "var(--tint-amber)" },
  "/fonctionnalites#comptabilite": { icon: "Calculator", c: "var(--brand-green-ink)", t: "#e5f7ea" },
  "/avantages": { icon: "Star", c: "var(--brand-violet)", t: "var(--tint-violet)" },
  "/tarifs": { icon: "Wallet", c: "var(--brand-amber-ink)", t: "var(--tint-amber)" },
  "/securite": { icon: "ShieldCheck", c: "var(--brand-indigo)", t: "#e8e8f6" },
  "/contact": { icon: "Headset", c: "var(--brand-violet)", t: "var(--tint-violet)" },
  "/logiciel-podologue": { icon: "MapPin", c: "var(--brand-teal-ink)", t: "var(--tint-teal)" },
  "/blog": { icon: "FileText", c: "var(--brand-blue)", t: "var(--tint-blue)" },
  "/tarifs#faq": { icon: "Info", c: "var(--brand-teal-ink)", t: "var(--tint-teal)" },
  "/a-propos": { icon: "Users", c: "var(--brand-green-ink)", t: "#e5f7ea" },
};

export function navMeta(href: string): Meta {
  return BY_PATH[href] ?? BLUE;
}
