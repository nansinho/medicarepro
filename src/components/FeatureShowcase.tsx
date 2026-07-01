"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import Reveal from "@/components/motion/Reveal";
import Parallax from "@/components/motion/Parallax";
import StaggerGroup from "@/components/motion/StaggerGroup";
import StaggerItem from "@/components/motion/StaggerItem";
import AppMockup from "@/components/motion/AppMockup";
import {
  Invoice,
  Signature,
  Calculator,
  Calendar,
  FileText,
  Smartphone,
  ShieldPlus,
  Star,
  Users,
  Monitor,
  Check,
  ArrowRight,
} from "@/components/icons";
import type { FeatureDetail } from "@/data/features";
import s from "./featureShowcase.module.css";

const ICONS = {
  Invoice,
  Signature,
  Calculator,
  Calendar,
  FileText,
  Smartphone,
  ShieldPlus,
  Star,
  Users,
  Monitor,
} as const;

/**
 * Section détaillée d'une fonctionnalité : texte (gauche/droite) + écran
 * factice animé. Apparitions au scroll, parallax sur le mockup.
 */
export default function FeatureShowcase({
  feature,
  reverse = false,
  tone = "white",
  bgImage,
}: {
  feature: FeatureDetail;
  reverse?: boolean;
  tone?: "white" | "soft" | "medium" | "dark";
  /** Image de fond (sections "dark" uniquement). Chemin sous /public. */
  bgImage?: string;
}) {
  const Icon = ICONS[feature.icon];
  const toneCls =
    tone === "soft"
      ? "tone-soft"
      : tone === "medium"
        ? "tone-medium"
        : tone === "dark"
          ? s.dark
          : "tone-white";

  // Sur une section foncée, on injecte l'image via la variable CSS.
  const style =
    tone === "dark" && bgImage
      ? ({ "--showcase-img": `url("${bgImage}")` } as CSSProperties)
      : undefined;

  return (
    <section className={`${s.showcase} ${toneCls}`} style={style}>
      <div className={`wrap ${s.grid} ${reverse ? s.reverse : ""}`}>
        <Reveal variant={reverse ? "right" : "left"} className={s.text}>
          <div className={s.iconRow}>
            <span className={s.icon}>
              <Icon width={26} height={26} />
            </span>
            <span className={s.kicker}>{feature.kicker}</span>
          </div>
          <h2 className={s.title}>{feature.title}</h2>
          <p className={s.lead}>{feature.text}</p>
          <StaggerGroup as="ul" className={s.points}>
            {feature.points.map((p) => (
              <StaggerItem as="li" key={p} variant="up">
                <span className={s.tick}>
                  <Check width={13} height={13} />
                </span>
                {p}
              </StaggerItem>
            ))}
          </StaggerGroup>
          {feature.href && (
            <Link href={feature.href} className={s.more}>
              {feature.hrefLabel ?? "En savoir plus"}{" "}
              <ArrowRight width={16} height={16} />
            </Link>
          )}
        </Reveal>

        <Parallax amount={20} className={s.visual}>
          <AppMockup kind={feature.mockup} />
        </Parallax>
      </div>
    </section>
  );
}
