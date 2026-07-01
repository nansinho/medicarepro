import type { Metadata } from "next";
import Link from "next/link";
import { CrossLinks } from "@/components/Sections";
import BilansHero from "@/components/BilansHero";
import AvantagesShowcase from "@/components/AvantagesShowcase";
import type { AvantageSection } from "@/components/AvantagesShowcase";
import BilansTimeline from "@/components/BilansTimeline";
import Reveal from "@/components/motion/Reveal";
import StaggerGroup from "@/components/motion/StaggerGroup";
import StaggerItem from "@/components/motion/StaggerItem";
import TiltCard from "@/components/motion/TiltCard";
import CountUp from "@/components/motion/CountUp";
import {
  ArrowRight,
  Eye,
  Shield,
  User,
  FileText,
  Grid,
  Refresh,
  BadgeCheck,
  Info,
  Clock,
  CheckCircle,
  Calculator,
  TrendingUp,
} from "@/components/icons";
import p from "@/components/pages.module.css";
import f from "@/components/featureShowcase.module.css";

export const metadata: Metadata = {
  title: "Logiciel de bilan podologique — 13 bilans spécialisés",
  description:
    "13 bilans podologiques normés avec scores calculés automatiquement : statique, dynamique, vasculaire, neurologique, posturologie, diabétique, chutes, pédiatrie et plus. Tout inclus dans l'abonnement.",
  alternates: { canonical: "/bilans" },
};

/* 3 sections vedettes immersives (mockups animés), dont une « dark ». */
const SHOWCASE: AvantageSection[] = [
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
    tone: "white",
    reverse: false,
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
    image: "/images/fonctionnalites/podologue-medicarepro-section-4.jpg",
    alt: "Podologue évaluant un risque de chute",
    tone: "dark",
    reverse: true,
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
    tone: "soft",
    reverse: false,
  },
];

/* Atouts cliniques (bande dark vedette avant la liste). */
const BENEFITS = [
  {
    icon: Calculator,
    title: "Scores calculés automatiquement",
    text: "Plus de calcul manuel : chaque grille produit son score instantanément.",
  },
  {
    icon: BadgeCheck,
    title: "Grilles cliniques normées",
    text: "Des évaluations validées, conformes aux référentiels podologiques.",
  },
  {
    icon: TrendingUp,
    title: "Suivi comparatif dans le temps",
    text: "Comparez les évaluations d'une consultation à l'autre, sans ressaisie.",
  },
  {
    icon: FileText,
    title: "Rattaché au dossier patient",
    text: "Chaque bilan s'enregistre dans le dossier, prêt à l'export.",
  },
];

/** Bilans d'examen clinique (8). */
const EXAM = [
  {
    icon: BadgeCheck,
    title: "Bilan statique",
    text: "Évaluation posturale complète : genu varum/valgum, scoliose, bassin, rachis.",
  },
  {
    icon: Refresh,
    title: "Bilan dynamique",
    text: "Analyse de la marche, déroulé du pas, appui et propulsion.",
  },
  {
    icon: Eye,
    title: "Bilan cutané / trophique",
    text: "État de la peau, lésions, hyperkératoses, mycoses, ongles.",
  },
  {
    icon: CheckCircle,
    title: "Bilan vasculaire",
    text: "Pouls, IPS (index de pression systolique), signes d'insuffisance veineuse/artérielle.",
  },
  {
    icon: User,
    title: "Examen morphologique du pied",
    text: "Forme du pied, hallux valgus, orteils en griffe, voûte plantaire.",
  },
  {
    icon: FileText,
    title: "Bilan articulaire",
    text: "Mobilité hanche, genou, cheville, sous-talienne, métatarso-phalangienne.",
  },
  {
    icon: Grid,
    title: "Bilan neurologique",
    text: "Monofilament, diapason, réflexes, proprioception, force motrice.",
  },
  {
    icon: FileText,
    title: "Tests membres inférieurs",
    text: "Tests spécifiques du membre inférieur (Thomas, Ober, tiroir…).",
  },
];

/** Bilans spécifiques (5). */
const SPECIFIC = [
  {
    icon: Eye,
    title: "Bilan posturologie",
    text: "Romberg, test unipodal, TUG, Fukuda, convergence oculaire, ATM, capteurs posturaux.",
  },
  {
    icon: Clock,
    title: "Bilan sport",
    text: "Profil athlète, analyse biomécanique, proprioception, instabilité cheville, pression plantaire.",
  },
  {
    icon: Info,
    title: "Bilan chutes",
    text: "7+ critères de risque, TUG, test unipodal, chair stand test, classification du risque.",
  },
  {
    icon: Shield,
    title: "Bilan diabétique",
    text: "45+ champs : monofilament, IPS, grade de risque (0-3), auto-examen, recommandations.",
  },
  {
    icon: User,
    title: "Bilan pédiatrie",
    text: "Foot Posture Index (FPI), genu valgum/varum, torsion tibiale, oculomotricité, marche.",
  },
];

const STEPS = [
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
];

const STATS = [
  { icon: FileText, to: 13, suffix: "", label: "bilans podologiques inclus" },
  { icon: Calculator, to: 45, prefix: "+", suffix: "", label: "champs sur le bilan diabétique" },
  { icon: Refresh, to: 100, suffix: " %", label: "scores calculés automatiquement" },
  { icon: BadgeCheck, to: 0, suffix: " €", label: "de supplément, tout est inclus" },
];

/** Une grille de bilans : cartes claires animées (icône + titre + texte). */
function BilanGrid({
  title,
  items,
}: {
  title: string;
  items: { icon: typeof FileText; title: string; text: string }[];
}) {
  return (
    <div className={p.bilanGroup}>
      <Reveal>
        <h2 className={p.bilanGroupTitle}>{title}</h2>
      </Reveal>
      <StaggerGroup className={p.bilanGrid}>
        {items.map(({ icon: Icon, title, text }) => (
          <StaggerItem key={title} variant="scale">
            <TiltCard className={p.bilanCard}>
              <div className={p.bilanIco}>
                <Icon width={22} height={22} />
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </TiltCard>
          </StaggerItem>
        ))}
      </StaggerGroup>
    </div>
  );
}

export default function BilansPage() {
  return (
    <>
      <BilansHero />

      {/* 3 bilans phares en sections immersives (mockup animé), dont 1 vedette foncée */}
      {SHOWCASE.map((section) => (
        <AvantagesShowcase key={section.title} {...section} />
      ))}

      {/* Bande « Avantages cliniques » — vedette foncée immersive */}
      <section className={`${f.statBand} ${f.statDark}`}>
        <div className={`wrap ${f.statInner}`}>
          <Reveal className={f.statHead}>
            <div className={f.statKicker}>Pourquoi ces bilans</div>
            <h2 className={f.statTitle}>Des bilans conçus pour la clinique</h2>
          </Reveal>
          <StaggerGroup className={p.benefitGrid}>
            {BENEFITS.map(({ icon: Icon, title, text }) => (
              <StaggerItem className={p.benefitCard} key={title} variant="up">
                <div className={p.benefitIco}>
                  <Icon width={24} height={24} />
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* Les 13 bilans, en 2 groupes — cartes claires sur fond blanc */}
      <section className={`${p.bilansList} tone-white`}>
        <div className="wrap">
          <Reveal className="sec-head">
            <div className="kicker">La liste complète</div>
            <h2 className="sec-title">Les 13 bilans spécialisés</h2>
          </Reveal>
          <BilanGrid title="Bilans d'examen clinique" items={EXAM} />
          <BilanGrid title="Bilans spécifiques" items={SPECIFIC} />
        </div>
      </section>

      {/* Comment ça marche — timeline animée */}
      <section className={`${p.bilansSteps} tone-soft`}>
        <div className="wrap">
          <Reveal className="sec-head">
            <div className="kicker">Comment ça marche</div>
            <h2 className="sec-title">Des scores calculés en 3 étapes</h2>
          </Reveal>
          <BilansTimeline steps={STEPS} />
        </div>
      </section>

      {/* Bande de statistiques — bandeau foncé immersif */}
      <section className={`${f.statBand} ${f.statDark}`}>
        <div className={`wrap ${f.statInner}`}>
          <Reveal className={f.statHead}>
            <div className={f.statKicker}>En chiffres</div>
            <h2 className={f.statTitle}>Des bilans qui font la différence</h2>
          </Reveal>
          <StaggerGroup className={f.statGrid}>
            {STATS.map(({ icon: Icon, ...stat }) => (
              <StaggerItem key={stat.label} className={f.stat} variant="up">
                <span className={f.statIco}>
                  <Icon width={22} height={22} />
                </span>
                <b>
                  <CountUp
                    to={stat.to}
                    prefix={stat.prefix ?? ""}
                    suffix={stat.suffix}
                  />
                </b>
                <span className={f.statLabel}>{stat.label}</span>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* CTA final spectaculaire */}
      <section className={f.ctaSec}>
        <div className="wrap">
          <Reveal variant="scale" className={f.ctaPanel}>
            <div className={f.ctaGlow} />
            <div className={f.ctaContent}>
              <div className={f.ctaKicker}>Tout inclus, sans option</div>
              <h2 className={f.ctaTitle}>
                Les 13 bilans inclus dans votre abonnement
              </h2>
              <p className={f.ctaLead}>
                Scores calculés, grilles validées et suivi patient — à partir de
                24,84 €/mois, sans supplément ni option payante.
              </p>
              <div className={f.ctaActions}>
                <Link href="/register?plan=annual" className={f.ctaBtnPrimary}>
                  Commencer maintenant <ArrowRight width={18} height={18} />
                </Link>
                <Link href="/tarifs" className={f.ctaBtnGhost}>
                  Voir les tarifs
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <CrossLinks
        links={[
          { href: "/avantages", label: "Les avantages" },
          { href: "/fonctionnalites", label: "Toutes les fonctionnalités" },
          { href: "/securite", label: "Sécurité & conformité" },
        ]}
      />
    </>
  );
}
