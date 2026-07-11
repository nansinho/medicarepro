import type { Metadata } from "next";
import { CrossLinks } from "@/components/Sections";
import BilansHero from "@/components/BilansHero";
import AvantagesShowcase from "@/components/AvantagesShowcase";
import BilansTimeline from "@/components/BilansTimeline";
import StatsBand from "@/components/cms/StatsBand";
import CtaPanel from "@/components/cms/CtaPanel";
import Reveal from "@/components/motion/Reveal";
import StaggerGroup from "@/components/motion/StaggerGroup";
import StaggerItem from "@/components/motion/StaggerItem";
import TiltCard from "@/components/motion/TiltCard";
import {
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
  Foot,
  Insole,
} from "@/components/icons";
import { getPageSections, pick } from "@/lib/cms/pages";
import { getFeatureItems } from "@/lib/cms/collections";
import { pageMetadata } from "@/lib/cms/seo";
import type { SectionContentOf } from "@/lib/cms/sections.schema";
import p from "@/components/pages.module.css";
import f from "@/components/featureShowcase.module.css";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/bilans");
}

/* Icônes des cartes de bilans et des atouts cliniques (clés string du CMS). */
const ICONS = {
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
  Foot,
  Insole,
} as const;

/** Une grille de bilans : cartes claires animées (icône + titre + texte). */
function BilanGrid({
  group,
}: {
  group: SectionContentOf<"bilan_groups">["groups"][number];
}) {
  return (
    <div className={p.bilanGroup}>
      <Reveal>
        <h2 className={p.bilanGroupTitle}>{group.title}</h2>
      </Reveal>
      <StaggerGroup className={p.bilanGrid}>
        {group.items.map(({ icon, title, text }) => {
          const Icon = ICONS[icon as keyof typeof ICONS];
          return (
            <StaggerItem key={title} variant="scale">
              <TiltCard className={p.bilanCard}>
                <div className={p.bilanIco}>
                  <Icon width={22} height={22} />
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </TiltCard>
            </StaggerItem>
          );
        })}
      </StaggerGroup>
    </div>
  );
}

export default async function BilansPage() {
  const [sections, bilans] = await Promise.all([
    getPageSections("/bilans"),
    getFeatureItems("bilans"),
  ]);
  const hero = pick(sections, "hero", "page_hero");
  const showcase = pick(sections, "showcase", "feature_showcase");
  const benefits = pick(sections, "benefits", "benefit_band");
  const groups = pick(sections, "groups", "bilan_groups");
  const steps = pick(sections, "steps", "timeline");
  const stats = pick(sections, "stats", "stats_band");
  const cta = pick(sections, "cta", "cta_panel");
  const crossLinks = pick(sections, "cross_links", "cross_links");

  const items = showcase.limit ? bilans.slice(0, showcase.limit) : bilans;

  return (
    <>
      <BilansHero content={hero} />

      {/* 3 bilans phares en sections immersives (mockup animé), dont 1 vedette foncée */}
      {items.map((item, i) => {
        const background = showcase.backgrounds?.find((bg) => bg.index === i);
        return (
          <AvantagesShowcase
            key={item.title}
            icon={item.icon}
            kicker={item.kicker}
            title={item.title}
            text={item.text}
            points={item.points}
            mockup={item.mockup}
            image={background?.image.path}
            alt={background?.image.alt}
            tone={showcase.tones?.[i] ?? "white"}
            reverse={i % 2 === 1}
          />
        );
      })}

      {/* Bande « Avantages cliniques » — vedette foncée immersive */}
      <section className={`${f.statBand} ${f.statDark}`}>
        <div className={`wrap ${f.statInner}`}>
          <Reveal className={f.statHead}>
            <div className={f.statKicker}>{benefits.kicker}</div>
            <h2 className={f.statTitle}>{benefits.title}</h2>
          </Reveal>
          <StaggerGroup className={p.benefitGrid}>
            {benefits.items.map(({ icon, title, text }) => {
              const Icon = ICONS[icon as keyof typeof ICONS];
              return (
                <StaggerItem className={p.benefitCard} key={title} variant="up">
                  <div className={p.benefitIco}>
                    <Icon width={24} height={24} />
                  </div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </StaggerItem>
              );
            })}
          </StaggerGroup>
        </div>
      </section>

      {/* Les 13 bilans, en 2 groupes — cartes claires sur fond blanc */}
      <section className={`${p.bilansList} tone-white`}>
        <div className="wrap">
          <Reveal className="sec-head">
            <div className="kicker">{groups.kicker}</div>
            <h2 className="sec-title">{groups.title}</h2>
          </Reveal>
          {groups.groups.map((group) => (
            <BilanGrid key={group.title} group={group} />
          ))}
        </div>
      </section>

      {/* Comment ça marche — timeline animée */}
      <section className={`${p.bilansSteps} tone-soft`}>
        <div className="wrap">
          <Reveal className="sec-head">
            <div className="kicker">{steps.kicker}</div>
            <h2 className="sec-title">{steps.title}</h2>
          </Reveal>
          <BilansTimeline steps={steps.steps} />
        </div>
      </section>

      {/* Bande de statistiques — bandeau foncé immersif */}
      <StatsBand content={stats} />

      {/* CTA final spectaculaire */}
      <CtaPanel content={cta} />

      <CrossLinks links={crossLinks.links} />
    </>
  );
}
