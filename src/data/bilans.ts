import type { FeatureDetail } from "@/data/features";

/**
 * Bilans phares mis en avant en sections détaillées (texte + mockup animé),
 * sur le modèle des FEATURES_DETAIL de la page Fonctionnalités. On illustre
 * les bilans les plus différenciants ; les 13 restent listés en grille.
 */
export const BILANS_DETAIL: FeatureDetail[] = [
  {
    icon: "ShieldPlus",
    kicker: "Le plus complet",
    title: "Le bilan du pied diabétique, complet",
    text: "Plus de 45 champs guidés : monofilament, IPS, gradation du risque (0-3), auto-examen et recommandations. Le grade de risque est calculé automatiquement pour sécuriser votre suivi et tracer chaque évaluation.",
    points: [
      "Grade de risque (0-3) calculé automatiquement",
      "Monofilament, IPS et pouls intégrés",
      "Auto-examen et conseils patient générés",
      "Comparaison du suivi dans le temps",
    ],
    mockup: "bilan",
  },
  {
    icon: "Star",
    kicker: "Prévention",
    title: "Évaluez le risque de chute en quelques clics",
    text: "7+ critères de risque, TUG, test unipodal, chair stand test : l'application classe automatiquement le niveau de risque pour orienter votre prise en charge et repérer tôt les patients fragiles.",
    points: [
      "7+ critères de risque pondérés",
      "TUG, test unipodal & chair stand test",
      "Classification automatique du risque",
      "Repérage précoce des patients fragiles",
    ],
    mockup: "bilanChute",
  },
  {
    icon: "FileText",
    kicker: "Grille validée",
    title: "Une grille posturale validée, prête à l'emploi",
    text: "Romberg, test unipodal, TUG, Fukuda, convergence oculaire, ATM, capteurs posturaux : tous les items normés réunis dans une interface claire, sans ressaisie, rattachés au dossier patient.",
    points: [
      "Tous les items normés réunis",
      "Capteurs posturaux & ATM",
      "Convergence oculaire & oculomotricité",
      "Saisie guidée, sans ressaisie",
    ],
    mockup: "bilanPosturo",
  },
];
