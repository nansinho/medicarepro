import type { MockupKind } from "@/components/motion/AppMockup";

export type FeatureIcon =
  | "Invoice"
  | "Signature"
  | "Calculator"
  | "Calendar"
  | "FileText"
  | "Smartphone"
  | "ShieldPlus"
  | "Star"
  | "Users"
  | "Monitor"
  | "Foot"
  | "Insole";

export type FeatureDetail = {
  /** Nom de l'icône dans icons.tsx. */
  icon: FeatureIcon;
  kicker: string;
  title: string;
  text: string;
  points: string[];
  mockup: MockupKind;
  /** Lien optionnel « En savoir plus ». */
  href?: string;
  hrefLabel?: string;
};

/**
 * Contenu détaillé des fonctionnalités (enrichi depuis le site en ligne).
 * Prix conservé : 24,84 €/mois (offre 12 mois).
 */
export const FEATURES_DETAIL: FeatureDetail[] = [
  {
    icon: "Invoice",
    kicker: "Facturation",
    title: "Facturation 100 % automatique",
    text: "Soins, bilans, orthèses plantaires : chaque acte génère sa facture automatiquement. Numérotation légale, TVA, mentions obligatoires et envoi au patient. Zéro ressaisie, zéro oubli.",
    points: [
      "Génération auto à chaque soin",
      "Numérotation séquentielle conforme",
      "Relances et suivi des impayés",
      "Export comptable en un clic",
    ],
    mockup: "invoice",
  },
  {
    icon: "Signature",
    kicker: "Signature",
    title: "Signature électronique eIDAS",
    text: "Faites signer consentements et documents avec une signature électronique à valeur juridique (règlement eIDAS). Horodatée, archivée et opposable.",
    points: [
      "Valeur juridique (eIDAS)",
      "Horodatage certifié",
      "Archivage à valeur probante",
      "Signature à distance",
    ],
    mockup: "signature",
  },
  {
    icon: "Calculator",
    kicker: "Comptabilité",
    title: "Comptabilité : remplacez votre comptable",
    text: "Tenez votre comptabilité sans expert. Export FEC, CSV et PDF, plan comptable général (PCG) mappé automatiquement, journaux et grand livre prêts pour votre AGA.",
    points: [
      "Export FEC, CSV et PDF",
      "Mapping PCG automatique",
      "Journaux & grand livre",
      "Capitaux propres en temps réel",
    ],
    mockup: "accounting",
  },
  {
    icon: "Calendar",
    kicker: "Agenda",
    title: "Agenda intégré : fini Doctolib à 150 €/mois",
    text: "Un agenda pensé pour vos journées de soins et de bilans : prise de rendez-vous en ligne, rappels email et SMS automatiques (J-7, J-2), synchronisation et gestion multi-praticien.",
    points: [
      "Prise de RDV en ligne",
      "Rappels email / SMS (J-7, J-2)",
      "Moins de rendez-vous manqués",
      "Inclus, sans surcoût",
    ],
    mockup: "agenda",
  },
  {
    icon: "Foot",
    kicker: "Bilans",
    title: "13 bilans podologiques normés",
    text: "Des bilans cliniques complets avec scores calculés automatiquement, grilles validées et recommandations : diabétique, chutes, posturologie, pédiatrie, sport…",
    points: [
      "Scores calculés automatiquement",
      "Grilles cliniques validées",
      "Recommandations intégrées",
      "13 bilans spécialisés inclus",
    ],
    mockup: "bilan",
    href: "/bilans",
    hrefLabel: "Découvrir les 13 bilans",
  },
  {
    icon: "Smartphone",
    kicker: "Mobilité",
    title: "App mobile (PWA) + scan de documents",
    text: "Installez MediCare Pro sur mobile et tablette (PWA) et travaillez partout, au cabinet comme en soins à domicile. Auto-sauvegarde en temps réel, scan des ordonnances et documents à la caméra.",
    points: [
      "Installable (PWA)",
      "Auto-sauvegarde temps réel",
      "Scan caméra / webcam",
      "Idéal en soins à domicile",
    ],
    mockup: "pwa",
  },
  {
    icon: "ShieldPlus",
    kicker: "SESAM-Vitale",
    title: "Carte Vitale & télétransmission",
    text: "Lisez la carte Vitale et l'ApCV, sécurisez l'identité du patient et préparez la télétransmission de vos actes. Solution agréée CNDA, intégrée au flux de soins de votre cabinet.",
    points: [
      "Lecture carte Vitale & ApCV",
      "Agrément CNDA",
      "Identité patient sécurisée",
      "Prêt pour la télétransmission",
    ],
    mockup: "vitale",
  },
  {
    icon: "Star",
    kicker: "Intelligence artificielle",
    title: "Comptes-rendus cliniques assistés par IA",
    text: "Dictez ou saisissez vos observations — hyperkératose, appui pronateur — et l'IA rédige un compte-rendu clinique clair et structuré en quelques secondes. Vous gardez la main, vous gagnez du temps.",
    points: [
      "Rédaction clinique structurée",
      "Gain de temps à chaque consultation",
      "Vous validez et ajustez",
      "Données de santé protégées",
    ],
    mockup: "ai",
  },
  {
    icon: "Users",
    kicker: "Portail patient",
    title: "Un espace dédié à vos patients",
    text: "Vos patients prennent rendez-vous en ligne, retrouvent leurs documents et le suivi de leurs semelles orthopédiques, et échangent avec vous en toute sécurité, depuis leur propre espace.",
    points: [
      "Prise de rendez-vous en ligne",
      "Accès aux documents",
      "Messagerie sécurisée",
      "Moins d'appels au cabinet",
    ],
    mockup: "portal",
  },
  {
    icon: "Monitor",
    kicker: "Pilotage",
    title: "Statistiques, traçabilité & multi-cabinet",
    text: "Pilotez votre activité — consultations, semelles, chiffre d'affaires — avec des statistiques claires, assurez la traçabilité de vos appareillages (matériovigilance) et gérez plusieurs cabinets et collaborateurs depuis un seul compte.",
    points: [
      "Tableau de bord statistiques",
      "Traçabilité & matériovigilance",
      "Multi-cabinet & collaborateurs",
      "Vue d'ensemble en temps réel",
    ],
    mockup: "stats",
  },
];
