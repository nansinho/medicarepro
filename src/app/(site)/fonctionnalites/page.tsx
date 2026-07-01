import type { Metadata } from "next";
import Link from "next/link";
import FeaturesHero from "@/components/FeaturesHero";
import FeatureShowcase from "@/components/FeatureShowcase";
import Reveal from "@/components/motion/Reveal";
import StaggerGroup from "@/components/motion/StaggerGroup";
import StaggerItem from "@/components/motion/StaggerItem";
import TiltCard from "@/components/motion/TiltCard";
import CountUp from "@/components/motion/CountUp";
import {
  FileText,
  ShieldCheck,
  CheckCircle,
  ArrowRight,
  Grid,
  Calculator,
  Refresh,
} from "@/components/icons";
import { FEATURES_DETAIL } from "@/data/features";
import p from "@/components/pages.module.css";
import f from "@/components/featureShowcase.module.css";

export const metadata: Metadata = {
  title: "Fonctionnalités du logiciel podologue",
  description:
    "Toutes les fonctionnalités de MediCare Pro : facturation automatique, signature électronique eIDAS, comptabilité, agenda intégré, 13 bilans podologiques et application mobile (PWA).",
  alternates: { canonical: "/fonctionnalites" },
};

/** Alternance des fonds sur les 6 sections détaillées. */
/* Séquence de fonds pour les 10 sections : alternance white/soft/medium,
   ponctuée de 2 sections « vedettes » à fond foncé pour casser le rythme. */
const SHOWCASE_TONES = [
  "white", // Facturation
  "soft", // Signature
  "medium", // Comptabilité
  "dark", // Agenda (vedette foncée)
  "white", // Bilans
  "soft", // PWA
  "medium", // Vitale
  "dark", // IA (vedette foncée)
  "white", // Portail
  "soft", // Stats
] as const;

/* Photo de fond propre à chaque section foncée (évite le doublon). */
const SHOWCASE_BG: Record<number, string> = {
  3: "/images/fonctionnalites/podologue-medicarepro-section-1.jpg", // Agenda
  7: "/images/fonctionnalites/podologue-medicarepro-section-4.jpg", // IA
};

const HUB = [
  {
    icon: FileText,
    title: "Bilans podologiques",
    text: "13 bilans normés avec scores calculés automatiquement : diabétique, risque de chute, posturologie et plus.",
    href: "/bilans",
  },
  {
    icon: ShieldCheck,
    title: "Sécurité & conformité",
    text: "Hébergement HDS en France, conformité RGPD, chiffrement et sauvegardes quotidiennes de vos données patients.",
    href: "/securite",
  },
  {
    icon: CheckCircle,
    title: "Les avantages",
    text: "Simplicité, tout-en-un, gain de temps : pourquoi les podologues choisissent MediCare Pro au quotidien.",
    href: "/avantages",
  },
];

const STATS = [
  { icon: Grid, to: 10, suffix: "", label: "fonctionnalités majeures incluses" },
  { icon: FileText, to: 13, suffix: "", label: "bilans podologiques inclus" },
  {
    icon: Calculator,
    to: 260,
    prefix: "−",
    suffix: " €",
    label: "par mois vs outils séparés",
  },
  { icon: Refresh, to: 100, suffix: " %", label: "automatique, sans ressaisie" },
];

export default function FonctionnalitesPage() {
  return (
    <>
      <FeaturesHero />

      {/* 10 sections détaillées, alternance de fonds + 2 sections vedettes foncées */}
      {FEATURES_DETAIL.map((feature, i) => (
        <FeatureShowcase
          key={feature.title}
          feature={feature}
          reverse={i % 2 === 1}
          tone={SHOWCASE_TONES[i] ?? "white"}
          bgImage={SHOWCASE_BG[i]}
        />
      ))}

      {/* Bande de statistiques — bandeau foncé immersif */}
      <section className={`${f.statBand} ${f.statDark}`}>
        <div className={`wrap ${f.statInner}`}>
          <Reveal className={f.statHead}>
            <div className={f.statKicker}>En chiffres</div>
            <h2 className={f.statTitle}>Un seul outil, tout votre cabinet</h2>
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
            <div className="kicker">Explorer en détail</div>
            <h2 className="sec-title">Tout ce que MediCare Pro vous apporte</h2>
          </Reveal>
          <StaggerGroup className={f.portalGrid}>
            {HUB.map(({ icon: Icon, title, text, href }) => (
              <StaggerItem key={href} variant="up">
                <TiltCard className={f.portalCard}>
                  <Link href={href} className={f.portalLink}>
                    <div className={f.portalIco}>
                      <Icon width={30} height={30} />
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
      <FeaturesCta />
    </>
  );
}

/* CTA spectaculaire de fin de page Fonctionnalités. */
function FeaturesCta() {
  return (
    <section className={f.ctaSec}>
      <div className="wrap">
        <Reveal variant="scale" className={f.ctaPanel}>
          <div className={f.ctaGlow} />
          <div className={f.ctaContent}>
            <div className={f.ctaKicker}>Prêt à gagner du temps&nbsp;?</div>
            <h2 className={f.ctaTitle}>
              Tout votre cabinet, réuni dans une seule application
            </h2>
            <p className={f.ctaLead}>
              Facturation, bilans, agenda, comptabilité et signature électronique
              — à partir de 24,84 €/mois, tout inclus.
            </p>
            <div className={f.ctaActions}>
              <Link href="/register?plan=annual" className={f.ctaBtnPrimary}>
                Je m&apos;abonne <ArrowRight width={18} height={18} />
              </Link>
              <Link href="/contact" className={f.ctaBtnGhost}>
                Demander une démo
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
