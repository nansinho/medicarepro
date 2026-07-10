/**
 * Contenu de la page /bilans — extraction 1:1 de :
 * src/app/(site)/bilans/page.tsx + BilansHero.tsx.
 * Les 3 sections vedettes (SHOWCASE) = collection feature_items "bilans"
 * (mêmes textes que BILANS_DETAIL) ; tones/backgrounds portés ici.
 * Conventions : `\n` = <br />, `**…**` = accent, U+00A0 = &nbsp;.
 */
import type { ManagedPageContent } from "@/lib/cms/sections.schema";

export const PAGE_BILANS = {
  slug: "/bilans",
  title: "Bilans",
  sections: [
    {
      key: "hero",
      type: "page_hero",
      content: {
        type: "page_hero",
        badge: "Exclusivité MediCare Pro",
        title: "13 bilans podologiques normés, **scores calculés pour vous.**",
        lead: "Bilans cliniques complets, grilles validées et recommandations.\nAucun autre logiciel ne propose autant d'évaluations spécialisées.",
      },
    },
    {
      key: "showcase",
      type: "feature_showcase",
      content: {
        type: "feature_showcase",
        collection: "bilans",
        tones: [
          "white", // Pied diabétique
          "dark", // Risque de chute (vedette foncée)
          "soft", // Grille posturale
        ],
        backgrounds: [
          {
            index: 1,
            image: {
              mediaId: null,
              path: "/images/fonctionnalites/podologue-medicarepro-section-4.jpg",
              alt: "Podologue évaluant un risque de chute",
            },
          },
        ],
      },
    },
    {
      key: "benefits",
      type: "benefit_band",
      content: {
        type: "benefit_band",
        kicker: "Pourquoi ces bilans",
        title: "Des bilans conçus pour la clinique",
        items: [
          {
            icon: "Calculator",
            title: "Scores calculés automatiquement",
            text: "Plus de calcul manuel : chaque grille produit son score instantanément.",
          },
          {
            icon: "BadgeCheck",
            title: "Grilles cliniques normées",
            text: "Des évaluations validées, conformes aux référentiels podologiques.",
          },
          {
            icon: "TrendingUp",
            title: "Suivi comparatif dans le temps",
            text: "Comparez les évaluations d'une consultation à l'autre, sans ressaisie.",
          },
          {
            icon: "FileText",
            title: "Rattaché au dossier patient",
            text: "Chaque bilan s'enregistre dans le dossier, prêt à l'export.",
          },
        ],
      },
    },
    {
      key: "groups",
      type: "bilan_groups",
      content: {
        type: "bilan_groups",
        kicker: "La liste complète",
        title: "Les 13 bilans spécialisés",
        groups: [
          {
            title: "Bilans d'examen clinique",
            items: [
              {
                icon: "BadgeCheck",
                title: "Bilan statique",
                text: "Évaluation posturale complète : genu varum/valgum, scoliose, bassin, rachis.",
              },
              {
                icon: "Refresh",
                title: "Bilan dynamique",
                text: "Analyse de la marche, déroulé du pas, appui et propulsion.",
              },
              {
                icon: "Eye",
                title: "Bilan cutané / trophique",
                text: "État de la peau, lésions, hyperkératoses, mycoses, ongles.",
              },
              {
                icon: "CheckCircle",
                title: "Bilan vasculaire",
                text: "Pouls, IPS (index de pression systolique), signes d'insuffisance veineuse/artérielle.",
              },
              {
                icon: "User",
                title: "Examen morphologique du pied",
                text: "Forme du pied, hallux valgus, orteils en griffe, voûte plantaire.",
              },
              {
                icon: "FileText",
                title: "Bilan articulaire",
                text: "Mobilité hanche, genou, cheville, sous-talienne, métatarso-phalangienne.",
              },
              {
                icon: "Grid",
                title: "Bilan neurologique",
                text: "Monofilament, diapason, réflexes, proprioception, force motrice.",
              },
              {
                icon: "FileText",
                title: "Tests membres inférieurs",
                text: "Tests spécifiques du membre inférieur (Thomas, Ober, tiroir…).",
              },
            ],
          },
          {
            title: "Bilans spécifiques",
            items: [
              {
                icon: "Eye",
                title: "Bilan posturologie",
                text: "Romberg, test unipodal, TUG, Fukuda, convergence oculaire, ATM, capteurs posturaux.",
              },
              {
                icon: "Clock",
                title: "Bilan sport",
                text: "Profil athlète, analyse biomécanique, proprioception, instabilité cheville, pression plantaire.",
              },
              {
                icon: "Info",
                title: "Bilan chutes",
                text: "7+ critères de risque, TUG, test unipodal, chair stand test, classification du risque.",
              },
              {
                icon: "Shield",
                title: "Bilan diabétique",
                text: "45+ champs : monofilament, IPS, grade de risque (0-3), auto-examen, recommandations.",
              },
              {
                icon: "User",
                title: "Bilan pédiatrie",
                text: "Foot Posture Index (FPI), genu valgum/varum, torsion tibiale, oculomotricité, marche.",
              },
            ],
          },
        ],
      },
    },
    {
      key: "steps",
      type: "timeline",
      content: {
        type: "timeline",
        kicker: "Comment ça marche",
        title: "Des scores calculés en 3 étapes",
        steps: [
          {
            title: "Choisissez le bilan",
            text: "Sélectionnez le bilan normé adapté à votre patient parmi les 13 évaluations spécialisées intégrées.",
          },
          {
            title: "Saisissez vos observations",
            text: "Renseignez les items dans une interface claire, sans ressaisie. Tout est rattaché automatiquement au dossier patient.",
          },
          {
            title: "Obtenez le score automatiquement",
            text: "L'application calcule les scores normés instantanément et sécurise votre suivi dans le temps. Gagnez du temps à chaque consultation.",
          },
        ],
      },
    },
    {
      key: "stats",
      type: "stats_band",
      content: {
        type: "stats_band",
        kicker: "En chiffres",
        title: "Des bilans qui font la différence",
        stats: [
          {
            icon: "FileText",
            to: 13,
            suffix: "",
            label: "bilans podologiques inclus",
          },
          {
            icon: "Calculator",
            to: 45,
            prefix: "+",
            suffix: "",
            label: "champs sur le bilan diabétique",
          },
          {
            icon: "Refresh",
            to: 100,
            suffix: " %",
            label: "scores calculés automatiquement",
          },
          {
            icon: "BadgeCheck",
            to: 0,
            suffix: " €",
            label: "de supplément, tout est inclus",
          },
        ],
      },
    },
    {
      key: "cta",
      type: "cta_panel",
      content: {
        type: "cta_panel",
        kicker: "Tout inclus, sans option",
        title: "Les 13 bilans inclus dans votre abonnement",
        lead: "Scores calculés, grilles validées et suivi patient — à partir de 24,84 €/mois, sans supplément ni option payante.",
        primary: { label: "Commencer maintenant", href: "app:register:annual" },
        secondary: { label: "Voir les tarifs", href: "/tarifs" },
      },
    },
    {
      key: "cross_links",
      type: "cross_links",
      content: {
        type: "cross_links",
        links: [
          { label: "Les avantages", href: "/avantages" },
          { label: "Toutes les fonctionnalités", href: "/fonctionnalites" },
          { label: "Sécurité & conformité", href: "/securite" },
        ],
      },
    },
  ],
} satisfies ManagedPageContent;
