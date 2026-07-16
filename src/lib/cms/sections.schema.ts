/**
 * Registre zod des sections de pages gérées — SOURCE DE VÉRITÉ UNIQUE.
 *
 * Chaque row `page_sections` porte un payload JSONB validé par l'un des
 * schémas ci-dessous (union discriminée sur `type`). Ce registre pilote :
 *  - la validation des payloads (seed, écriture admin, lecture publique),
 *  - les formulaires d'édition admin (SectionFormRenderer, phase 5),
 *  - le rendu public (props des composants existants).
 *
 * Conventions de contenu (documentées pour les convertisseurs/renderers) :
 *  - `\n` dans un titre/lead = retour à la ligne explicite (<br /> dans le JSX).
 *  - `**…**` dans un titre = segment accentué (span accent dégradé du design) ;
 *    dans un paragraphe = graisse (<strong>/<b>).
 *  - Les espaces insécables du JSX (&nbsp;) sont des vrais U+00A0 (` `).
 *  - `href` d'un LinkRef : chemin interne ("/tarifs"), URL absolue, ou lien
 *    spécial vers l'app SaaS résolu via src/lib/appLinks.ts :
 *    "app:register:annual" | "app:register:monthly" | "app:register" | "app:login".
 *  - Icônes = clés string résolues dans src/components/icons.tsx (pattern existant).
 *  - `_v` = version du schéma du payload (tolérance de migration), défaut 1.
 */
import { z } from "zod";

export const SCHEMA_VERSION = 1;

/* ------------------------------------------------------------------ */
/* Primitives partagées                                                */
/* ------------------------------------------------------------------ */

/** Icônes utilisées dans du CONTENU (sous-ensemble des exports d'icons.tsx). */
export const IconKeySchema = z.enum([
  "ShieldPlus",
  "Shield",
  "ShieldCheck",
  "Phone",
  "Mail",
  "MapPin",
  "Headset",
  "Lock",
  "CheckCircle",
  "Grid",
  "Clock",
  "FileText",
  "Signature",
  "Calculator",
  "Calendar",
  "Smartphone",
  "Invoice",
  "BadgeCheck",
  "Refresh",
  "Monitor",
  "User",
  "Star",
  "Facebook",
  "LinkedIn",
  "Instagram",
  "XSocial",
  "Eye",
  "Users",
  "Info",
  "Server",
  "Key",
  "Globe",
  "Sparkles",
  "Zap",
  "TrendingUp",
  "Wallet",
  "Layers",
  "Foot",
  "Insole",
]);
export type IconKey = z.infer<typeof IconKeySchema>;

/** Tonalité de fond standard (alternance blanc / bleu clair / bleu moyen). */
export const ToneSchema = z.enum(["white", "soft", "medium"]);
export type Tone = z.infer<typeof ToneSchema>;

/** Tonalité étendue : les showcases acceptent aussi "dark" (vedette foncée). */
export const ToneWithDarkSchema = z.enum(["white", "soft", "medium", "dark"]);
export type ToneWithDark = z.infer<typeof ToneWithDarkSchema>;

/** Écrans d'app factices animés (src/components/motion/AppMockup.tsx). */
export const MockupKindSchema = z.enum([
  "invoice",
  "signature",
  "accounting",
  "agenda",
  "bilan",
  "bilanChute",
  "bilanPosturo",
  "pwa",
  "vitale",
  "ai",
  "portal",
  "stats",
]);
export type MockupKindKey = z.infer<typeof MockupKindSchema>;

/** Référence image : row `media` (uuid) OU chemin legacy sous /public. */
export const ImageRefSchema = z.object({
  mediaId: z.uuid().nullable(),
  path: z.string(),
  alt: z.string(),
});
export type ImageRef = z.infer<typeof ImageRefSchema>;

/** Lien : libellé + href (cf. convention `href` en tête de fichier). */
export const LinkRefSchema = z.object({
  label: z.string(),
  href: z.string(),
});
export type LinkRef = z.infer<typeof LinkRefSchema>;

/** Compteur animé (CountUp) : `to` numérique + préfixe/suffixe/décimales. */
export const CountStatSchema = z.object({
  icon: IconKeySchema,
  to: z.number(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  decimals: z.number().optional(),
  label: z.string(),
});
export type CountStat = z.infer<typeof CountStatSchema>;

/** Carte icône + titre + texte (valeurs, bénéfices, grilles de bilans…). */
export const IconItemSchema = z.object({
  icon: IconKeySchema,
  title: z.string(),
  text: z.string(),
});
export type IconItem = z.infer<typeof IconItemSchema>;

/** Pastille de confiance : icône + libellé court. */
export const TrustChipSchema = z.object({
  icon: IconKeySchema,
  label: z.string(),
});
export type TrustChip = z.infer<typeof TrustChipSchema>;

/** Étape numérotée (timelines, parcours contact). */
export const StepSchema = z.object({
  title: z.string(),
  text: z.string(),
});
export type Step = z.infer<typeof StepSchema>;

/** Champ commun de version de payload. */
const versioned = { _v: z.number().default(SCHEMA_VERSION) };

/* ------------------------------------------------------------------ */
/* Schémas de sections                                                 */
/* ------------------------------------------------------------------ */

/** Hero générique des pages intérieures (PageHero + heros cinématiques :
 *  FeaturesHero, BilansHero (badge), SecurityHero/AvantagesHero (trust)). */
export const PageHeroSchema = z.object({
  type: z.literal("page_hero"),
  ...versioned,
  kicker: z.string().optional(),
  /** Badge animé au-dessus du titre (ex. « Exclusivité MediCare Pro »). */
  badge: z.string().optional(),
  title: z.string(),
  lead: z.string(),
  /** Photo en filigrane sous le dégradé (décorative, alt ""). */
  image: ImageRefSchema.optional(),
  /** background-position de la photo. Défaut "center 30%". */
  imagePos: z.string().optional(),
  /** Rangée de mini-badges de confiance sous le lead. */
  trust: z.array(TrustChipSchema).optional(),
});

/** Hero de la page d'accueil (src/components/Hero.tsx). */
export const HomeHeroSchema = z.object({
  type: z.literal("home_hero"),
  ...versioned,
  title: z.string(),
  lead: z.string(),
  /** CTA « Voir la démo » (bouton play). */
  demoCta: LinkRefSchema,
  /** Prix en texte simple, cliquable vers /tarifs. */
  priceCta: z.object({
    label: z.string(),
    amount: z.string(),
    note: z.string(),
    href: z.string(),
  }),
  /** Carte preuve sociale : avatars défilants + compteur animé (`count`)
   *  ou accroche texte (`headline`) quand aucun chiffre n'est affiché. */
  proof: z.object({
    count: z.number().optional(),
    prefix: z.string().optional(),
    headline: z.string().optional(),
    label: z.string(),
    avatars: z.array(ImageRefSchema),
  }),
  /** Photo détourée du duo de praticiens (fond du hero). */
  photos: z.object({
    duo: ImageRefSchema,
  }),
  /** Barre d'infos flottante sous le hero. */
  infoBar: z.object({
    items: z.array(
      z.object({
        icon: IconKeySchema,
        title: z.string(),
        value: z.string(),
      }),
    ),
    cta: LinkRefSchema,
  }),
});

/** Grille bento de la home (src/components/HomeBento.tsx). */
export const BentoSchema = z.object({
  type: z.literal("bento"),
  ...versioned,
  kicker: z.string(),
  title: z.string(),
  lead: z.string(),
  /** Cellule vedette : mockup animé. */
  mockup: z.object({
    kicker: z.string(),
    title: z.string(),
    kind: MockupKindSchema,
  }),
  /** Cellules compteurs animés. */
  counters: z.array(CountStatSchema),
  /** Cellule badge HDS pulsé. */
  hds: z.object({
    icon: IconKeySchema,
    title: z.string(),
    sub: z.string(),
  }),
});

/** Défilement cinématique des fonctionnalités de la home
 *  (src/components/HomeFeatureScroll.tsx) — items = collection feature_items. */
export const FeatureScrollSchema = z.object({
  type: z.literal("feature_scroll"),
  ...versioned,
  kicker: z.string(),
  title: z.string(),
  /** Nombre de features mises en scène (FEATURES_DETAIL.slice(0, limit)). */
  limit: z.number(),
});

/** Manifesto immersif (le « pourquoi » en une phrase). */
export const ManifestoSchema = z.object({
  type: z.literal("manifesto"),
  ...versioned,
  kicker: z.string(),
  title: z.string(),
  text: z.string(),
  link: LinkRefSchema.optional(),
});

/** Bandeau foncé de statistiques animées (statBand/statDark). */
export const StatsBandSchema = z.object({
  type: z.literal("stats_band"),
  ...versioned,
  kicker: z.string(),
  title: z.string(),
  stats: z.array(CountStatSchema),
});

/** Timeline verticale d'étapes (BilansTimeline). */
export const TimelineSchema = z.object({
  type: z.literal("timeline"),
  ...versioned,
  kicker: z.string().optional(),
  title: z.string().optional(),
  steps: z.array(StepSchema),
});

/** Récit « Notre histoire » (page À propos). */
export const StorySchema = z.object({
  type: z.literal("story"),
  ...versioned,
  kicker: z.string(),
  title: z.string(),
  /** Paragraphes ; `**…**` = <strong>. */
  paragraphs: z.array(z.string()),
  signature: z.string().optional(),
});

/** Nos engagements (composant Values de Sections.tsx). */
export const ValuesSchema = z.object({
  type: z.literal("values"),
  ...versioned,
  kicker: z.string(),
  title: z.string(),
  items: z.array(IconItemSchema),
  /** Lien « En savoir plus → » (mode teaser). */
  teaserHref: z.string().optional(),
});

/** Suite de sections détaillées alimentée par la collection feature_items
 *  (FeatureShowcase sur /fonctionnalites, AvantagesShowcase sur /bilans). */
export const FeatureShowcaseSchema = z.object({
  type: z.literal("feature_showcase"),
  ...versioned,
  collection: z.enum(["features", "bilans"]),
  /** Limite d'items (défaut : toute la collection). */
  limit: z.number().optional(),
  /** Tonalité de fond par index d'item (défaut "white"). */
  tones: z.array(ToneWithDarkSchema).optional(),
  /** Photos de fond des sections "dark", adressées par index d'item. */
  backgrounds: z
    .array(
      z.object({
        index: z.number(),
        image: ImageRefSchema,
      }),
    )
    .optional(),
});

/** Section détaillée autonome : texte + points + mockup OU photo
 *  (SecurityShowcase / AvantagesShowcase avec payload propre à la page). */
export const ShowcaseSchema = z.object({
  type: z.literal("showcase"),
  ...versioned,
  icon: IconKeySchema,
  kicker: z.string(),
  title: z.string(),
  text: z.string(),
  points: z.array(z.string()),
  /** Mockup animé (colonne visuelle des sections claires). */
  mockup: MockupKindSchema.optional(),
  /** Photo : colonne visuelle, ou fond immersif si tone === "dark". */
  image: ImageRefSchema.optional(),
  tone: ToneWithDarkSchema,
  reverse: z.boolean(),
});

/** Témoignages (composant Reviews) — personnes = collection testimonials. */
export const ReviewsSchema = z.object({
  type: z.literal("reviews"),
  ...versioned,
  kicker: z.string(),
  title: z.string(),
  tone: ToneSchema.optional(),
  /** Bandeau de preuve sociale : note moyenne (optionnel — non affiché tant
   *  qu'il n'y a pas de vrais avis). */
  rating: z
    .object({
      value: z.string(),
      label: z.string(),
    })
    .optional(),
});

/** FAQ (accordéon) — questions = collection faq_items. */
export const FaqSchema = z.object({
  type: z.literal("faq"),
  ...versioned,
  kicker: z.string().optional(),
  title: z.string().optional(),
});

/** Copie de la section Tarifs (PricingPage.tsx) — les cartes = collection
 *  pricing_plans, les lignes du tableau = collection pricing_examples. */
export const PricingSchema = z.object({
  type: z.literal("pricing"),
  ...versioned,
  /** Titre (`**…**` = span accent). */
  title: z.string(),
  subtitle: z.string(),
  examplesTitle: z.string(),
  tableHead: z.object({
    config: z.string(),
    monthly: z.string(),
    yearly: z.string(),
  }),
  /** Liens de navigation sous le tableau. */
  navLinks: z.array(LinkRefSchema),
  /** Bande CTA de bas de section. */
  ctaBand: z.object({
    title: z.string(),
    text: z.string(),
    cta: LinkRefSchema,
    note: z.string(),
  }),
});

/** Comparatif économies : outils séparés vs MediCare Pro
 *  (SavingsCompare.tsx sur /avantages, bloc Économies sur /tarifs). */
export const SavingsCompareSchema = z.object({
  type: z.literal("savings_compare"),
  ...versioned,
  kicker: z.string(),
  title: z.string(),
  lead: z.string(),
  before: z.object({
    label: z.string(),
    /** Total mensuel en euros (285). */
    price: z.number(),
    priceNote: z.string().optional(),
    totalLabel: z.string().optional(),
    /** Détail des outils remplacés (variante riche /avantages). */
    tools: z
      .array(
        z.object({
          icon: IconKeySchema,
          label: z.string(),
          price: z.string(),
        }),
      )
      .optional(),
  }),
  after: z.object({
    label: z.string(),
    /** Prix mensuel en euros (24.84). */
    price: z.number(),
    priceNote: z.string().optional(),
    badge: z.string().optional(),
    points: z.array(z.string()).optional(),
  }),
  /** Phrase de résultat (`**…**` = <b>). Variante /tarifs. */
  result: z.string().optional(),
  /** Stats : soit compteur animé (icon+to), soit valeur texte (value). */
  stats: z.array(
    z.object({
      icon: IconKeySchema.optional(),
      to: z.number().optional(),
      prefix: z.string().optional(),
      suffix: z.string().optional(),
      decimals: z.number().optional(),
      value: z.string().optional(),
      label: z.string(),
    }),
  ),
  tone: ToneSchema.optional(),
});

/** Bande CTA compacte (CtaBand de Sections2.tsx). */
export const CtaBandSchema = z.object({
  type: z.literal("cta_band"),
  ...versioned,
  title: z.string(),
  text: z.string(),
  cta: LinkRefSchema,
  tone: ToneSchema.optional(),
});

/** Panneau CTA spectaculaire de fin de page (HomeCta/FeaturesCta pattern). */
export const CtaPanelSchema = z.object({
  type: z.literal("cta_panel"),
  ...versioned,
  kicker: z.string(),
  title: z.string(),
  lead: z.string(),
  primary: LinkRefSchema,
  secondary: LinkRefSchema,
  trust: z.array(TrustChipSchema).optional(),
});

/** Rangée de liens internes entre pages connexes (maillage SEO). */
export const CrossLinksSchema = z.object({
  type: z.literal("cross_links"),
  ...versioned,
  links: z.array(LinkRefSchema),
});

/** Section Contact : canaux + microcopie du formulaire (ContactSection.tsx).
 *  Les labels/placeholders des champs restent dans le composant (structure). */
export const ContactChannelsSchema = z.object({
  type: z.literal("contact_channels"),
  ...versioned,
  kicker: z.string(),
  title: z.string(),
  text: z.string(),
  channels: z.array(
    z.object({
      icon: IconKeySchema,
      title: z.string(),
      value: z.string(),
      note: z.string(),
      href: z.string().optional(),
    }),
  ),
  hdsLine: z.string(),
  form: z.object({
    title: z.string(),
    sub: z.string(),
    consent: z.string(),
    submitLabel: z.string(),
    successTitle: z.string(),
    successText: z.string(),
    /** Rappel HDS sous le bouton d'envoi. */
    footNote: z.string(),
  }),
});

/** Étapes « Et ensuite ? » de la page Contact. */
export const ContactStepsSchema = z.object({
  type: z.literal("contact_steps"),
  ...versioned,
  kicker: z.string(),
  title: z.string(),
  steps: z.array(StepSchema),
});

/** Bande foncée d'atouts (bilans « Avantages cliniques »). */
export const BenefitBandSchema = z.object({
  type: z.literal("benefit_band"),
  ...versioned,
  kicker: z.string(),
  title: z.string(),
  items: z.array(IconItemSchema),
});

/** Les 13 bilans en groupes de cartes (/bilans). */
export const BilanGroupsSchema = z.object({
  type: z.literal("bilan_groups"),
  ...versioned,
  kicker: z.string(),
  title: z.string(),
  groups: z.array(
    z.object({
      title: z.string(),
      items: z.array(IconItemSchema),
    }),
  ),
});

/** Grandes cartes portail vers les pages connexes (blocs HUB). */
export const PortalCardsSchema = z.object({
  type: z.literal("portal_cards"),
  ...versioned,
  kicker: z.string(),
  title: z.string(),
  /** Libellé du lien de carte (« Découvrir »). */
  linkLabel: z.string().optional(),
  cards: z.array(
    z.object({
      icon: IconKeySchema,
      title: z.string(),
      text: z.string(),
      href: z.string(),
      /** Pastille chiffrée optionnelle (« 13 bilans »). */
      stat: z.string().optional(),
    }),
  ),
});

/** Bande hébergeur OVHcloud (/securite). Le logo OVH est fixe (design). */
export const HostBandSchema = z.object({
  type: z.literal("host_band"),
  ...versioned,
  kicker: z.string(),
  title: z.string(),
  text: z.string(),
  points: z.array(z.string()),
  /** Légende sous le logo (« Hébergeur certifié HDS »). */
  logoCaption: z.string(),
});

/** Corps riche (pages légales) : document Tiptap JSON minimal. */
export const RichTextSchema = z.object({
  type: z.literal("rich_text"),
  ...versioned,
  body: z.object({
    type: z.literal("doc"),
    content: z.array(z.any()),
  }),
});

/** Teaser des derniers articles du blog (composant Blog de Sections2.tsx). */
export const BlogTeaserSchema = z.object({
  type: z.literal("blog_teaser"),
  ...versioned,
  kicker: z.string(),
  title: z.string(),
  limit: z.number().optional(),
});

/* ---- Pages villes (/logiciel-podologue/[ville], phase ultérieure) ---- */

export const CityHeroSchema = z.object({
  type: z.literal("city_hero"),
  ...versioned,
  kicker: z.string().optional(),
  title: z.string(),
  lead: z.string(),
  image: ImageRefSchema.optional(),
});

export const CityIntroSchema = z.object({
  type: z.literal("city_intro"),
  ...versioned,
  heading: z.string(),
  paragraphs: z.array(z.string()),
});

export const CityFaqSchema = z.object({
  type: z.literal("city_faq"),
  ...versioned,
  items: z.array(
    z.object({
      q: z.string(),
      a: z.string(),
    }),
  ),
});

/* ------------------------------------------------------------------ */
/* Union discriminée + registre                                        */
/* ------------------------------------------------------------------ */

export const SECTION_SCHEMAS = {
  page_hero: PageHeroSchema,
  home_hero: HomeHeroSchema,
  bento: BentoSchema,
  feature_scroll: FeatureScrollSchema,
  manifesto: ManifestoSchema,
  stats_band: StatsBandSchema,
  timeline: TimelineSchema,
  story: StorySchema,
  values: ValuesSchema,
  feature_showcase: FeatureShowcaseSchema,
  showcase: ShowcaseSchema,
  reviews: ReviewsSchema,
  faq: FaqSchema,
  pricing: PricingSchema,
  savings_compare: SavingsCompareSchema,
  cta_band: CtaBandSchema,
  cta_panel: CtaPanelSchema,
  cross_links: CrossLinksSchema,
  contact_channels: ContactChannelsSchema,
  contact_steps: ContactStepsSchema,
  benefit_band: BenefitBandSchema,
  bilan_groups: BilanGroupsSchema,
  portal_cards: PortalCardsSchema,
  host_band: HostBandSchema,
  rich_text: RichTextSchema,
  blog_teaser: BlogTeaserSchema,
  city_hero: CityHeroSchema,
  city_intro: CityIntroSchema,
  city_faq: CityFaqSchema,
} as const;

export const SectionContentSchema = z.discriminatedUnion("type", [
  PageHeroSchema,
  HomeHeroSchema,
  BentoSchema,
  FeatureScrollSchema,
  ManifestoSchema,
  StatsBandSchema,
  TimelineSchema,
  StorySchema,
  ValuesSchema,
  FeatureShowcaseSchema,
  ShowcaseSchema,
  ReviewsSchema,
  FaqSchema,
  PricingSchema,
  SavingsCompareSchema,
  CtaBandSchema,
  CtaPanelSchema,
  CrossLinksSchema,
  ContactChannelsSchema,
  ContactStepsSchema,
  BenefitBandSchema,
  BilanGroupsSchema,
  PortalCardsSchema,
  HostBandSchema,
  RichTextSchema,
  BlogTeaserSchema,
  CityHeroSchema,
  CityIntroSchema,
  CityFaqSchema,
]);

/** Payload de section VALIDÉ (post-parse : `_v` présent). */
export type SectionContent = z.infer<typeof SectionContentSchema>;
/** Payload de section en ENTRÉE (pré-parse : `_v` optionnel). */
export type SectionContentInput = z.input<typeof SectionContentSchema>;
export type SectionType = SectionContent["type"];

/** Payload d'entrée d'un type de section donné. */
export type SectionContentOf<T extends SectionType> = Extract<
  SectionContentInput,
  { type: T }
>;

/** Slot d'une page gérée : `type` DOIT correspondre à `content.type`
 *  (même contrainte que le CHECK SQL de `page_sections`). */
export type ManagedPageSection = {
  [T in SectionType]: {
    key: string;
    type: T;
    content: SectionContentOf<T>;
  };
}[SectionType];

/** Contenu complet d'une page gérée (slots ordonnés). */
export type ManagedPageContent = {
  slug: string;
  title: string;
  sections: ManagedPageSection[];
};

/* ------------------------------------------------------------------ */
/* Collections (tables réutilisables référencées par les sections)     */
/* ------------------------------------------------------------------ */

/** Témoignage (collection `testimonials`, composant Reviews). */
export const TestimonialSchema = z.object({
  name: z.string(),
  role: z.string(),
  avatar: ImageRefSchema,
  quote: z.string(),
});
export type Testimonial = z.infer<typeof TestimonialSchema>;

/** Formule tarifaire (collection `pricing_plans`, PricingPage.tsx). */
export const PricingPlanSchema = z.object({
  /** Clé résolue vers registerUrl(planKey) via appLinks. */
  planKey: z.enum(["monthly", "annual"]),
  name: z.string(),
  sub: z.string(),
  /** Prix TTC/mois en euros (nombre : 29.88 / 24.84). */
  price: z.number(),
  unit: z.string(),
  secondary: z.string(),
  featured: z.boolean().optional(),
  badge: z.string().optional(),
  features: z.array(
    z.object({
      label: z.string(),
      highlight: z.boolean().optional(),
    }),
  ),
  cta: z.string(),
});
export type PricingPlan = z.infer<typeof PricingPlanSchema>;

/** Ligne d'exemple de tarification (collection `pricing_examples`). */
export const PricingExampleSchema = z.object({
  config: z.string(),
  /** Prix mensuels en euros (nombres, formatés fr-FR au rendu). */
  monthly: z.number(),
  yearly: z.number(),
});
export type PricingExample = z.infer<typeof PricingExampleSchema>;

/** Fonctionnalité détaillée (collection `feature_items` :
 *  10 features + 3 bilans phares, cf. src/data/features.ts et bilans.ts). */
export const FeatureItemSchema = z.object({
  collection: z.enum(["features", "bilans"]),
  position: z.number(),
  icon: IconKeySchema,
  kicker: z.string(),
  title: z.string(),
  text: z.string(),
  points: z.array(z.string()),
  mockup: MockupKindSchema,
  href: z.string().optional(),
  hrefLabel: z.string().optional(),
});
export type FeatureItem = z.infer<typeof FeatureItemSchema>;

/** Question fréquente (collection `faq_items`, cf. src/data/faq.ts). */
export const FaqItemSchema = z.object({
  q: z.string(),
  a: z.string(),
});
export type FaqItem = z.infer<typeof FaqItemSchema>;
