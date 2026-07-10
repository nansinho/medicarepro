import Reveal from "@/components/motion/Reveal";
import StaggerGroup from "@/components/motion/StaggerGroup";
import StaggerItem from "@/components/motion/StaggerItem";
import CountUp from "@/components/motion/CountUp";
import {
  Grid,
  FileText,
  Calculator,
  Refresh,
  BadgeCheck,
  TrendingUp,
  Layers,
  Wallet,
  Server,
  Key,
  Globe,
  ShieldCheck,
  Invoice,
} from "@/components/icons";
import type { SectionContentOf } from "@/lib/cms/sections.schema";
import f from "@/components/featureShowcase.module.css";

/* Icônes des compteurs (clés string du contenu CMS). */
const ICONS = {
  Grid,
  FileText,
  Calculator,
  Refresh,
  BadgeCheck,
  TrendingUp,
  Layers,
  Wallet,
  Server,
  Key,
  Globe,
  ShieldCheck,
  Invoice,
} as const;

/**
 * Bandeau foncé de statistiques animées (sections `stats_band`) — recette
 * partagée des anciens blocs statBand/statDark codés dans chaque page.
 */
export default function StatsBand({
  content,
}: {
  content: SectionContentOf<"stats_band">;
}) {
  return (
    <section className={`${f.statBand} ${f.statDark}`}>
      <div className={`wrap ${f.statInner}`}>
        <Reveal className={f.statHead}>
          <div className={f.statKicker}>{content.kicker}</div>
          <h2 className={f.statTitle}>{content.title}</h2>
        </Reveal>
        <StaggerGroup className={f.statGrid}>
          {content.stats.map((stat) => {
            const Icon = ICONS[stat.icon as keyof typeof ICONS];
            return (
              <StaggerItem key={stat.label} className={f.stat} variant="up">
                <span className={f.statIco}>
                  <Icon width={22} height={22} />
                </span>
                <b>
                  <CountUp
                    to={stat.to}
                    prefix={stat.prefix ?? ""}
                    suffix={stat.suffix}
                    decimals={stat.decimals ?? 0}
                  />
                </b>
                <span className={f.statLabel}>{stat.label}</span>
              </StaggerItem>
            );
          })}
        </StaggerGroup>
      </div>
    </section>
  );
}
