"use client";

import Reveal from "@/components/motion/Reveal";
import StaggerGroup from "@/components/motion/StaggerGroup";
import StaggerItem from "@/components/motion/StaggerItem";
import CountUp from "@/components/motion/CountUp";
import {
  Calendar,
  Invoice,
  Calculator,
  Signature,
  Server,
  Check,
  TrendingUp,
  Wallet,
} from "@/components/icons";
import type { SectionContentOf } from "@/lib/cms/sections.schema";
import s from "./savings.module.css";

/* Icônes des outils remplacés et des compteurs (clés string du contenu CMS). */
const ICONS = {
  Calendar,
  Invoice,
  Calculator,
  Signature,
  Server,
  TrendingUp,
  Wallet,
} as const;

/**
 * Comparatif économies : carte « outils séparés » (détail à 285 €/mois) vs
 * carte premium MediCare Pro (24,84 €/mois), puis bandeau total animé.
 * Variante riche de la page Avantages (section `savings_compare`).
 */
export default function SavingsCompare({
  content,
}: {
  content: SectionContentOf<"savings_compare">;
}) {
  const tone = content.tone;
  const toneCls =
    tone === "soft"
      ? "tone-soft"
      : tone === "medium"
        ? "tone-medium"
        : "tone-white";

  return (
    <section className={`${s.savings} ${toneCls}`}>
      <div className="wrap">
        <Reveal className="sec-head">
          <div className="kicker">{content.kicker}</div>
          <h2 className="sec-title">{content.title}</h2>
          <p className="lead">{content.lead}</p>
        </Reveal>

        <div className={s.grid}>
          {/* Carte « outils séparés » — lignes en cascade */}
          <Reveal variant="left" className={s.before}>
            <div className={s.cardLabel}>{content.before.label}</div>
            <StaggerGroup as="ul" className={s.rows}>
              {content.before.tools?.map(({ icon, label, price }) => {
                const Icon = ICONS[icon as keyof typeof ICONS];
                return (
                  <StaggerItem as="li" className={s.row} key={label} variant="left">
                    <span className={s.rowIco}>
                      <Icon width={20} height={20} />
                    </span>
                    <span className={s.rowLabel}>{label}</span>
                    <span className={s.rowPrice}>{price}</span>
                  </StaggerItem>
                );
              })}
            </StaggerGroup>
            <div className={s.beforeTotal}>
              <span className={s.beforeTotalLabel}>
                {content.before.totalLabel}
              </span>
              <span className={s.beforeTotalPrice}>
                <CountUp to={content.before.price} suffix=" €" />{" "}
                <small>{content.before.priceNote}</small>
              </span>
            </div>
          </Reveal>

          {/* Carte premium MediCare Pro */}
          <Reveal variant="right" className={s.after}>
            <span className={s.afterGlow} aria-hidden="true" />
            <div className={s.afterContent}>
              <span className={s.afterBadge}>{content.after.badge}</span>
              <div className={s.afterName}>{content.after.label}</div>
              <div className={s.afterPrice}>
                <CountUp to={content.after.price} decimals={2} suffix=" €" />{" "}
                <small>{content.after.priceNote}</small>
              </div>
              <ul className={s.afterPoints}>
                {content.after.points?.map((point) => (
                  <li key={point}>
                    <span className={s.afterTick}>
                      <Check width={13} height={13} />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>

        {/* Bandeau total économisé (compteurs animés) */}
        <StaggerGroup className={s.result}>
          {content.stats.map((stat) => {
            const Icon = stat.icon
              ? ICONS[stat.icon as keyof typeof ICONS]
              : null;
            return (
              <StaggerItem className={s.resultCard} variant="up" key={stat.label}>
                <span className={s.resultIco}>
                  {Icon && <Icon width={24} height={24} />}
                </span>
                <span className={s.resultValue}>
                  <CountUp
                    to={stat.to ?? 0}
                    prefix={stat.prefix}
                    suffix={stat.suffix}
                  />
                </span>
                <span className={s.resultLabel}>{stat.label}</span>
              </StaggerItem>
            );
          })}
        </StaggerGroup>
      </div>
    </section>
  );
}
