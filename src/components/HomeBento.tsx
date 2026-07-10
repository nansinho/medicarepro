import Reveal from "@/components/motion/Reveal";
import StaggerGroup from "@/components/motion/StaggerGroup";
import StaggerItem from "@/components/motion/StaggerItem";
import TiltCard from "@/components/motion/TiltCard";
import CountUp from "@/components/motion/CountUp";
import AppMockup from "@/components/motion/AppMockup";
import { Wallet, FileText, ShieldCheck, Zap } from "@/components/icons";
import type { SectionContentOf } from "@/lib/cms/sections.schema";
import h from "./home.module.css";

/* Icônes des cellules (clés string du contenu CMS). */
const ICONS = { Wallet, FileText, ShieldCheck, Zap } as const;

/** Cellule compteur animé de la grille. */
function CounterCell({
  counter,
}: {
  counter: SectionContentOf<"bento">["counters"][number];
}) {
  const Icon = ICONS[counter.icon as keyof typeof ICONS];
  return (
    <StaggerItem variant="scale">
      <TiltCard className={h.cell}>
        <span className={h.numIco}>
          <Icon width={22} height={22} />
        </span>
        <span className={h.num}>
          <CountUp
            to={counter.to}
            prefix={counter.prefix}
            suffix={counter.suffix}
          />
        </span>
        <span className={h.numLabel}>{counter.label}</span>
      </TiltCard>
    </StaggerItem>
  );
}

/**
 * Grille « bento » de la page d'accueil : une seule section compacte qui donne
 * l'essentiel du produit en un coup d'œil — écran d'app animé, compteurs,
 * badge HDS pulsé. Chaque cellule vit (respiration, halo, tilt au survol).
 */
export default function HomeBento({
  content,
}: {
  content: SectionContentOf<"bento">;
}) {
  const HdsIcon = ICONS[content.hds.icon as keyof typeof ICONS];
  return (
    <section className={`${h.bentoSec} tone-white`}>
      <div className="wrap">
        <Reveal className="sec-head">
          <div className="kicker">{content.kicker}</div>
          <h2 className="sec-title">{content.title}</h2>
          <p className="lead">{content.lead}</p>
        </Reveal>

        <StaggerGroup className={h.bentoGrid}>
          {/* Vedette : écran d'app animé */}
          <StaggerItem className={h.spanLarge} variant="scale">
            <div className={`${h.cell} ${h.cellLarge}`}>
              <div className={h.cellHead}>
                <span className={h.cellKicker}>{content.mockup.kicker}</span>
                <h3 className={h.cellTitle}>{content.mockup.title}</h3>
              </div>
              <AppMockup kind={content.mockup.kind} />
            </div>
          </StaggerItem>

          {/* Compteurs, avec le badge HDS pulsé en 4e cellule (mise en page) */}
          {content.counters.slice(0, 2).map((counter) => (
            <CounterCell key={counter.label} counter={counter} />
          ))}

          {/* HDS / confiance */}
          <StaggerItem variant="scale">
            <TiltCard className={h.cell}>
              <span className={h.hdsRing}>
                <HdsIcon width={28} height={28} />
              </span>
              <span className={h.hdsTitle}>{content.hds.title}</span>
              <span className={h.hdsSub}>{content.hds.sub}</span>
            </TiltCard>
          </StaggerItem>

          {content.counters.slice(2).map((counter) => (
            <CounterCell key={counter.label} counter={counter} />
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}
