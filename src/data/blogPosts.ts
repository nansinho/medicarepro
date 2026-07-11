/**
 * Articles du blog — source de vérité unique.
 * Utilisés par la liste (/blog, composant Blog) et les pages de détail
 * (/blog/[slug]). Contenu structuré en sections (pas de markdown) pour un
 * rendu propre sans parseur.
 */

export type BlogSection = {
  /** Sous-titre h2 de la section (absent pour l'introduction). */
  heading?: string;
  /** Paragraphes de la section. */
  paragraphs: string[];
  /** Liste à puces optionnelle, affichée après les paragraphes. */
  list?: string[];
};

export type BlogPost = {
  slug: string;
  title: string;
  /** Date ISO (SEO, balise time). */
  date: string;
  /** Date affichée. */
  dateDisplay: string;
  image: string;
  imageAlt: string;
  /** Résumé (cartes + meta description). ≤160 caractères. */
  excerpt: string;
  /** Temps de lecture estimé. */
  readingTime: string;
  sections: BlogSection[];
  /** Corps riche Tiptap (articles créés via le back office) —
   *  prioritaire sur `sections` au rendu quand il est non vide. */
  body?: { type: "doc"; content: unknown[] };
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "pied-diabetique-suivi",
    title: "Pied du diabétique : les bons réflexes de suivi",
    date: "2026-06-12",
    dateDisplay: "12 juin 2026",
    image: "/images/blog-diabete.jpg",
    imageAlt: "Examen podologique d'un pied diabétique en cabinet",
    excerpt:
      "Gradation du risque, monofilament, IPS, fréquence de suivi : les réflexes essentiels pour un suivi rigoureux du pied diabétique en cabinet.",
    readingTime: "6 min",
    sections: [
      {
        paragraphs: [
          "Le pied diabétique reste l'une des complications les plus redoutées du diabète : on estime qu'un patient diabétique sur quatre développera une plaie du pied au cours de sa vie, et qu'une amputation liée au diabète survient toutes les vingt secondes dans le monde. Pourtant, la grande majorité de ces complications sont évitables grâce à un dépistage précoce et un suivi podologique structuré.",
          "Pour le pédicure-podologue, l'enjeu est double : identifier tôt les patients à risque grâce à une gradation rigoureuse, et assurer une traçabilité irréprochable du suivi dans le temps. Voici les réflexes essentiels à systématiser en cabinet.",
        ],
      },
      {
        heading: "La gradation du risque, socle du suivi",
        paragraphs: [
          "La classification internationale gradue le risque podologique de 0 à 3. Elle conditionne à la fois la fréquence de suivi recommandée et la prise en charge par l'Assurance Maladie des séances de prévention.",
        ],
        list: [
          "Grade 0 : absence de neuropathie sensitive — examen annuel de dépistage.",
          "Grade 1 : neuropathie sensitive isolée — bilan et surveillance au moins une fois par an.",
          "Grade 2 : neuropathie associée à une artériopathie ou une déformation du pied — suivi renforcé, séances de prévention prises en charge.",
          "Grade 3 : antécédent d'ulcération ou d'amputation — suivi rapproché et coordination étroite avec l'équipe de diabétologie.",
        ],
      },
      {
        heading: "Monofilament, IPS, pouls : le trio de l'examen",
        paragraphs: [
          "Le test au monofilament de 10 g reste l'examen de référence pour dépister la neuropathie sensitive. Appliqué sur des zones plantaires codifiées (pulpe du gros orteil, têtes métatarsiennes), il doit être réalisé dans le calme, en évitant les zones hyperkératosiques qui faussent la perception.",
          "L'évaluation vasculaire complète l'examen neurologique : palpation des pouls pédieux et tibiaux postérieurs, et mesure de l'IPS (index de pression systolique) lorsque l'artériopathie est suspectée. Un IPS inférieur à 0,9 oriente vers une artériopathie oblitérante des membres inférieurs et justifie un avis vasculaire.",
          "L'inspection cutanée et morphologique termine le bilan : hyperkératoses, fissures, mycoses, déformations (hallux valgus, orteils en griffe), points d'hyperappui — autant de portes d'entrée potentielles pour une plaie.",
        ],
      },
      {
        heading: "Éduquer le patient : l'auto-examen quotidien",
        paragraphs: [
          "Le meilleur suivi en cabinet ne remplace pas la vigilance quotidienne du patient. L'éducation thérapeutique fait partie intégrante de la consultation : inspection quotidienne des pieds (au besoin avec un miroir), séchage soigneux entre les orteils, chaussage adapté vérifié de la main avant l'enfilage, et consultation rapide au moindre signe d'alerte (rougeur, ampoule, plaie qui ne cicatrise pas).",
          "Remettre au patient une fiche de conseils personnalisée, adaptée à son grade de risque, augmente sensiblement l'observance de ces gestes simples.",
        ],
      },
      {
        heading: "Tracer chaque bilan pour objectiver l'évolution",
        paragraphs: [
          "Le suivi du pied diabétique s'inscrit dans la durée : c'est la comparaison des bilans successifs qui révèle une dégradation débutante — perte progressive de sensibilité, baisse de l'IPS, apparition d'une déformation. Un bilan normé, daté et rattaché au dossier patient est donc indispensable.",
          "C'est précisément ce que propose MediCare Pro : un bilan du pied diabétique de plus de 45 champs guidés, avec calcul automatique du grade de risque, recommandations générées et comparaison d'une consultation à l'autre. Le podologue se concentre sur l'examen clinique, l'application s'occupe du score et de la traçabilité.",
        ],
      },
    ],
  },
  {
    slug: "bien-choisir-ortheses-plantaires",
    title: "Bien choisir ses orthèses plantaires",
    date: "2026-06-05",
    dateDisplay: "5 juin 2026",
    image: "/images/blog-ortheses.jpg",
    imageAlt: "Orthèses plantaires sur mesure en cours de fabrication",
    excerpt:
      "Indications, examen préalable, matériaux et suivi : la démarche complète pour concevoir des orthèses plantaires réellement efficaces.",
    readingTime: "5 min",
    sections: [
      {
        paragraphs: [
          "L'orthèse plantaire est l'un des outils thérapeutiques majeurs du pédicure-podologue. Bien indiquée et bien conçue, elle soulage les douleurs, corrige ou compense un trouble statique et prévient les récidives. Mal indiquée, elle déçoit le patient et discrédite le traitement.",
          "La différence se joue rarement sur le matériau seul : elle se joue sur la rigueur de l'examen clinique préalable et sur la qualité du suivi. Retour sur la démarche complète.",
        ],
      },
      {
        heading: "Tout part de l'examen clinique",
        paragraphs: [
          "Avant de penser correction, il faut objectiver le trouble. L'examen statique évalue les appuis, l'alignement de l'arrière-pied, la hauteur de l'arche médiale et les éventuelles inégalités de longueur des membres inférieurs. L'examen dynamique analyse le déroulé du pas : phase taligrade, plantigrade, digitigrade, comportement de l'arrière-pied en charge.",
          "Les tests spécifiques complètent l'analyse — mobilité de la première colonne, test de Jack, examen articulaire de la cheville et de la sous-talienne. Ce bilan initial, consigné précisément, servira de référence pour mesurer l'efficacité de l'appareillage.",
        ],
      },
      {
        heading: "Corriger, compenser ou amortir : trois logiques",
        paragraphs: [
          "Le choix de l'orthèse découle de l'objectif thérapeutique. On distingue schématiquement trois logiques, souvent combinées :",
        ],
        list: [
          "Correction : réaligner une articulation réductible (ex. contrôle du valgus calcanéen chez un pied plat souple).",
          "Compensation : accommoder une déformation fixée ou une inégalité de longueur, en répartissant les contraintes.",
          "Amortissement et décharge : soulager une zone d'hyperappui douloureuse (métatarsalgies, talalgies) par des matériaux absorbants et des évidements ciblés.",
        ],
      },
      {
        heading: "Matériaux et fabrication : adapter au patient, pas l'inverse",
        paragraphs: [
          "Résines thermoformables, EVA de différentes densités, éléments collés sur support : chaque technique a ses indications. Un sportif recherchera dynamisme et faible encombrement dans la chaussure ; un patient âgé ou diabétique privilégiera l'accommodation et la protection cutanée ; un enfant nécessitera un appareillage évolutif, réévalué à chaque poussée de croissance.",
          "Le chaussage du patient fait partie intégrante de la prescription : la meilleure orthèse du monde ne corrige rien dans une chaussure inadaptée. Ce point mérite d'être abordé explicitement en consultation.",
        ],
      },
      {
        heading: "Le suivi, clé de l'efficacité",
        paragraphs: [
          "Une orthèse se contrôle : à un mois pour vérifier la tolérance et l'adaptation, puis à chaque renouvellement (en général tous les ans, plus fréquemment chez l'enfant). La comparaison avec le bilan initial objectivera les progrès — diminution de la douleur, amélioration du déroulé du pas — et orientera les ajustements.",
          "Avec MediCare Pro, l'examen morphostatique, les tests dynamiques et les prescriptions d'orthèses sont consignés dans des bilans normés rattachés au dossier patient. À chaque contrôle, le podologue compare les évaluations en un clin d'œil, et la facturation de l'appareillage est générée automatiquement.",
        ],
      },
    ],
  },
  {
    slug: "posturologie-comprendre-le-bilan",
    title: "Posturologie : comprendre le bilan",
    date: "2026-05-28",
    dateDisplay: "28 mai 2026",
    image: "/images/blog-posturologie.jpg",
    imageAlt: "Bilan postural d'un patient en cabinet de podologie",
    excerpt:
      "Capteurs posturaux, Romberg, Fukuda, convergence oculaire : ce que mesure réellement un bilan postural et comment l'interpréter.",
    readingTime: "6 min",
    sections: [
      {
        paragraphs: [
          "La posturologie étudie la façon dont le corps se stabilise debout, en intégrant les informations de plusieurs « capteurs » : le pied, l'œil, l'appareil manducateur (ATM), la peau et l'oreille interne. Lorsqu'un de ces capteurs délivre une information erronée, le système postural compense — parfois au prix de douleurs chroniques : lombalgies, cervicalgies, tendinopathies récidivantes.",
          "Le pédicure-podologue, spécialiste du capteur podal, est souvent en première ligne pour dépister un syndrome de déficience posturale. Encore faut-il un bilan structuré et reproductible. Voici ce qu'il doit contenir.",
        ],
      },
      {
        heading: "L'interrogatoire : chercher les signes d'appel",
        paragraphs: [
          "Douleurs rachidiennes chroniques sans cause retrouvée, instabilité, chutes à répétition, fatigue visuelle, céphalées, bruxisme : le faisceau d'arguments cliniques oriente vers une origine posturale. L'historique des traitements (orthèses antérieures, orthodontie, rééducation orthoptique) complète le tableau et guide l'examen.",
        ],
      },
      {
        heading: "Les tests posturaux de référence",
        paragraphs: [
          "Le bilan postural s'appuie sur une batterie de tests standardisés, réalisés dans des conditions reproductibles (même éclairage, mêmes consignes, pieds nus) :",
        ],
        list: [
          "Test de Romberg postural : oscillations et déviations du corps, yeux ouverts puis fermés — il oriente vers l'origine du trouble (visuelle, podale, vestibulaire).",
          "Test de piétinement de Fukuda : 50 pas sur place, yeux fermés ; une rotation supérieure à 30° signe une asymétrie tonique.",
          "Appui unipodal : stabilité comparée droite/gauche, indicateur simple et sensible.",
          "Convergence oculaire : un défaut de convergence est l'une des causes les plus fréquentes de trouble postural — il justifie un adressage orthoptique.",
          "Examen de l'ATM : ouverture buccale, déviations, claquements — en lien avec l'occlusion dentaire.",
        ],
      },
      {
        heading: "Interpréter : hiérarchiser les capteurs",
        paragraphs: [
          "L'objectif du bilan n'est pas d'accumuler les tests, mais de hiérarchiser : le capteur podal est-il causal, adaptatif ou mixte ? Les manœuvres de neutralisation (mousse sous les pieds, yeux fermés) permettent de faire la part des choses. Un trouble postural d'origine podale répondra aux orthèses posturales à éléments fins ; un trouble d'origine oculaire relève d'abord de l'orthoptiste, en coordination avec le podologue.",
          "Cette démarche pluridisciplinaire est la marque d'une posturologie sérieuse : le podologue traite ce qui relève du pied, et adresse ce qui n'en relève pas.",
        ],
      },
      {
        heading: "Un bilan normé pour un suivi objectif",
        paragraphs: [
          "La difficulté classique du bilan postural est sa reproductibilité : sans grille standardisée, difficile de comparer deux évaluations à six mois d'intervalle et d'objectiver l'effet des orthèses posturales.",
          "MediCare Pro intègre une grille posturale validée, prête à l'emploi : Romberg, Fukuda, appui unipodal, convergence, ATM et capteurs y sont consignés de façon structurée, avec un suivi comparatif automatique d'une consultation à l'autre. Le praticien gagne du temps de saisie et fiabilise son suivi.",
        ],
      },
    ],
  },
];

/** Retrouve un article par slug (ou undefined). */
export function getPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
