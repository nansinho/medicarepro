import type { Metadata } from "next";
import Link from "next/link";
import AvantagesHero from "@/components/AvantagesHero";
import AvantagesShowcase from "@/components/AvantagesShowcase";
import type { AvantageSection } from "@/components/AvantagesShowcase";
import SavingsCompare from "@/components/SavingsCompare";
import Reviews from "@/components/Reviews";
import Reveal from "@/components/motion/Reveal";
import StaggerGroup from "@/components/motion/StaggerGroup";
import StaggerItem from "@/components/motion/StaggerItem";
import TiltCard from "@/components/motion/TiltCard";
import CountUp from "@/components/motion/CountUp";
import {
  TrendingUp,
  Layers,
  FileText,
  Wallet,
  ShieldCheck,
  Calculator,
  Clock,
  ArrowRight,
} from "@/components/icons";
import f from "@/components/featureShowcase.module.css";

export const metadata: Metadata = {
  title: "Les avantages du logiciel tout-en-un",
  description:
    "Pourquoi les podologues choisissent MediCare Pro : tout-en-un, simple à prendre en main, gain de temps et jusqu'à 260 €/mois économisés vs des outils séparés. Tout inclus à partir de 24,84 €/mois.",
  alternates: { canonical: "/avantages" },
};

/* 5 sections immersives, alternées gauche/droite, 2 « vedettes » foncées. */
const SECTIONS: AvantageSection[] = [
  {
    icon: "Layers",
    kicker: "Tout-en-un",
    title: "Tout votre cabinet dans une seule application",
    text: "Fini les outils dispersés et les abonnements multiples. Patients, factures, comptabilité, agenda, bilans et signature : tout est réuni au même endroit, sans ressaisie.",
    points: [
      "Patients, factures, compta et agenda centralisés",
      "Aucune double saisie d'un outil à l'autre",
      "Une seule facture mensuelle, un seul interlocuteur",
      "10 fonctionnalités majeures incluses",
    ],
    mockup: "pwa",
    tone: "white",
    reverse: false,
  },
  {
    icon: "Sparkles",
    kicker: "Simplicité",
    title: "Une prise en main immédiate, sans formation",
    text: "Une interface claire, pensée pour les podologues et non pour les informaticiens. Vous êtes opérationnel dès le premier jour, sans manuel ni formation coûteuse.",
    points: [
      "Interface intuitive et épurée",
      "Opérationnel dès le premier jour",
      "Aucune formation requise",
      "Support humain réactif si besoin",
    ],
    mockup: "agenda",
    tone: "soft",
    reverse: true,
  },
  {
    icon: "Zap",
    kicker: "Gain de temps",
    title: "Des heures gagnées chaque semaine",
    text: "L'administratif tourne tout seul : factures générées automatiquement, scores de bilans calculés, rappels de rendez-vous envoyés. Vous vous concentrez sur vos patients.",
    points: [
      "Facturation générée 100 % automatiquement",
      "Scores et grades de bilans calculés",
      "Rappels de rendez-vous par email et SMS",
      "Beaucoup moins d'administratif au quotidien",
    ],
    image: "/images/fonctionnalites/podologue-medicarepro-section-2.jpg",
    alt: "Podologue qui gagne du temps grâce à l'automatisation",
    tone: "dark",
    reverse: false,
  },
  {
    icon: "FileText",
    kicker: "Cliniquement complet",
    title: "Les bilans les plus complets du marché",
    text: "13 bilans podologiques normés, du pied diabétique au risque de chute en passant par la posturologie, avec scores et grades calculés automatiquement pour un suivi fiable.",
    points: [
      "13 bilans podologiques inclus",
      "Scores et grades calculés automatiquement",
      "Grilles cliniques validées",
      "Suivi comparatif dans le temps",
    ],
    mockup: "bilan",
    tone: "white",
    reverse: true,
  },
  {
    icon: "ShieldCheck",
    kicker: "Confiance",
    title: "Vos données protégées au plus haut niveau",
    text: "Hébergement HDS en France chez OVHcloud, conformité RGPD, chiffrement de bout en bout et sauvegardes incluses : la sécurité de vos patients est garantie, sans surcoût.",
    points: [
      "Hébergement HDS en France",
      "Conformité RGPD",
      "Chiffrement de bout en bout",
      "Sauvegardes quotidiennes incluses",
    ],
    image: "/images/securite/podologue-medicarepro-servers-section1.jpg",
    alt: "Infrastructure sécurisée hébergeant les données MediCare Pro",
    tone: "dark",
    reverse: false,
  },
];

/* Bande de stats animées (fond clair). */
const STATS = [
  {
    icon: TrendingUp,
    to: 260,
    prefix: "−",
    suffix: " €",
    label: "économisés par mois en moyenne",
  },
  { icon: Layers, to: 10, suffix: "", label: "fonctionnalités majeures incluses" },
  { icon: FileText, to: 13, suffix: "", label: "bilans podologiques inclus" },
  { icon: Wallet, to: 3120, suffix: " €", label: "économisés par an, en moyenne" },
];

/* Cartes portail vers les pages connexes. */
const HUB = [
  {
    icon: Layers,
    title: "Toutes les fonctionnalités",
    text: "Facturation, signature, comptabilité, agenda, bilans et application mobile — le détail de tout ce qui est inclus.",
    href: "/fonctionnalites",
    stat: "10 fonctionnalités",
  },
  {
    icon: Calculator,
    title: "Tarifs tout inclus",
    text: "Un seul abonnement à 24,84 €/mois, sans option cachée. Comparez et calculez vos économies.",
    href: "/tarifs",
    stat: "24,84 €/mois",
  },
  {
    icon: FileText,
    title: "Les 13 bilans podologiques",
    text: "Le catalogue de bilans le plus complet du marché, avec scores calculés automatiquement.",
    href: "/bilans",
    stat: "13 bilans",
  },
];

export default function AvantagesPage() {
  return (
    <>
      <AvantagesHero />

      {/* 5 sections immersives, alternées + 2 vedettes foncées */}
      {SECTIONS.map((section) => (
        <AvantagesShowcase key={section.title} {...section} />
      ))}

      {/* Comparatif économies */}
      <SavingsCompare tone="soft" />

      {/* Témoignages clients (composant réutilisé) */}
      <Reviews tone="white" />

      {/* Bande de stats animées — vedette foncée immersive */}
      <section className={`${f.statBand} ${f.statDark}`}>
        <div className={`wrap ${f.statInner}`}>
          <Reveal className={f.statHead}>
            <div className={f.statKicker}>En chiffres</div>
            <h2 className={f.statTitle}>Le tout-en-un qui change la donne</h2>
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

      {/* Grandes cartes immersives vers les pages connexes */}
      <section className={`${f.portalSec} tone-soft`}>
        <div className="wrap">
          <Reveal className="sec-head">
            <div className="kicker">Aller plus loin</div>
            <h2 className="sec-title">Explorer MediCare Pro</h2>
          </Reveal>
          <StaggerGroup className={f.portalGrid}>
            {HUB.map(({ icon: Icon, title, text, href, stat }) => (
              <StaggerItem key={href} variant="up">
                <TiltCard className={f.portalCard}>
                  <Link href={href} className={f.portalLink}>
                    <div className={f.portalIcoRow}>
                      <div className={f.portalIco}>
                        <Icon width={30} height={30} />
                      </div>
                      <span className={f.portalStat}>{stat}</span>
                    </div>
                    <h3 className={f.portalTitle}>{title}</h3>
                    <p className={f.portalText}>{text}</p>
                    <span className={f.portalMore}>
                      Découvrir <ArrowRight width={16} height={16} />
                    </span>
                  </Link>
                </TiltCard>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* CTA final spectaculaire */}
      <AvantagesCta />
    </>
  );
}

/* CTA spectaculaire de fin de page Avantages. */
function AvantagesCta() {
  return (
    <section className={f.ctaSec}>
      <div className="wrap">
        <Reveal variant="scale" className={f.ctaPanel}>
          <div className={f.ctaGlow} />
          <div className={f.ctaContent}>
            <div className={f.ctaKicker}>Prêt à simplifier votre cabinet&nbsp;?</div>
            <h2 className={f.ctaTitle}>
              Tout votre cabinet réuni, pour 24,84 €/mois
            </h2>
            <p className={f.ctaLead}>
              Tout-en-un, sans option cachée — et plus de 3 000 € économisés par
              an en moyenne face aux outils séparés.
            </p>
            <div className={f.ctaActions}>
              <Link href="/register?plan=annual" className={f.ctaBtnPrimary}>
                Je m&apos;abonne <ArrowRight width={18} height={18} />
              </Link>
              <Link href="/contact" className={f.ctaBtnGhost}>
                Demander une démo
              </Link>
            </div>
            <div className={f.ctaTrust}>
              {[
                { icon: ShieldCheck, label: "Hébergé en France (HDS)" },
                { icon: Wallet, label: "Sans engagement" },
                { icon: Clock, label: "Opérationnel en 1 jour" },
              ].map(({ icon: Icon, label }) => (
                <span className={f.ctaTrustItem} key={label}>
                  <Icon width={16} height={16} /> {label}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
