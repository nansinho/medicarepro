import type { IconKey } from "@/lib/cms/sections.schema";

/* Pastille des entrées de menu : icône + couleur de module, choisies par
   route (les menus du CMS ne portent que libellé et lien). Une route
   inconnue retombe sur la pastille bleue générique.

   `d` : la ligne d'explication affichée sous le libellé dans les panneaux
   du menu. Une route inconnue n'en a pas, et le panneau s'en passe. */
type Meta = { icon: IconKey; c: string; t: string; d?: string };

const BLUE: Meta = { icon: "Grid", c: "var(--brand-blue)", t: "var(--tint-blue)" };

const BY_PATH: Record<string, Meta> = {
  "/fonctionnalites": {
    ...BLUE,
    d: "Le tour complet du logiciel, module par module.",
  },
  "/fonctionnalites#agenda": {
    icon: "Calendar",
    c: "var(--brand-blue)",
    t: "var(--tint-blue)",
    d: "Rendez-vous, rappels aux patients et agenda partagé du cabinet.",
  },
  "/bilans": {
    icon: "Foot",
    c: "var(--brand-teal-ink)",
    t: "var(--tint-teal)",
    d: "13 bilans podologiques normés, prêts à remplir en consultation.",
  },
  "/fonctionnalites#facturation": {
    icon: "Invoice",
    c: "var(--brand-amber-ink)",
    t: "var(--tint-amber)",
    d: "Factures, feuilles de soins et lecture de la carte Vitale.",
  },
  "/fonctionnalites#comptabilite": {
    icon: "Calculator",
    c: "var(--brand-green-ink)",
    t: "#e5f7ea",
    d: "Recettes, dépenses et suivi financier du cabinet.",
  },
  "/avantages": {
    icon: "Star",
    c: "var(--brand-violet)",
    t: "var(--tint-violet)",
    d: "Ce que le logiciel change au quotidien.",
  },
  "/tarifs": {
    icon: "Wallet",
    c: "var(--brand-amber-ink)",
    t: "var(--tint-amber)",
    d: "Une formule tout inclus, au mois ou sur 12 mois.",
  },
  "/securite": {
    icon: "ShieldCheck",
    c: "var(--brand-indigo)",
    t: "#e8e8f6",
    d: "Données de santé hébergées en France, chez un hébergeur agréé HDS.",
  },
  "/contact": {
    icon: "Headset",
    c: "var(--brand-violet)",
    t: "var(--tint-violet)",
    d: "Une présentation du logiciel avec un conseiller.",
  },
  "/logiciel-podologue": {
    icon: "MapPin",
    c: "var(--brand-teal-ink)",
    t: "var(--tint-teal)",
    d: "MediCare Pro dans votre ville et votre région.",
  },
  "/blog": {
    icon: "FileText",
    c: "var(--brand-blue)",
    t: "var(--tint-blue)",
    d: "Conseils, actualités de la profession et nouveautés.",
  },
  "/tarifs#faq": {
    icon: "Info",
    c: "var(--brand-teal-ink)",
    t: "var(--tint-teal)",
    d: "Les réponses aux questions qu'on nous pose le plus.",
  },
  "/a-propos": {
    icon: "Users",
    c: "var(--brand-green-ink)",
    t: "#e5f7ea",
    d: "L'équipe et l'histoire de MediCare Pro.",
  },
};

export function navMeta(href: string): Meta {
  return BY_PATH[href] ?? BLUE;
}

/* Phrase d'accroche d'un panneau de menu, choisie par la page du groupe.
   Un groupe inconnu n'en a pas : le panneau n'affiche alors que son titre. */
const INTRO_BY_PATH: Record<string, string> = {
  "/fonctionnalites":
    "Tout le cabinet de podologie dans une seule application, du rendez-vous à la comptabilité.",
  "/tarifs":
    "Une formule claire, un hébergement de santé agréé et un accompagnement humain.",
  "/blog": "Guides, actualités de la profession et réponses à vos questions.",
};

export function navIntro(href: string): string | undefined {
  return INTRO_BY_PATH[href.split("#")[0]];
}
