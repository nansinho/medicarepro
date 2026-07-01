"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import Reveal from "@/components/motion/Reveal";
import Parallax from "@/components/motion/Parallax";
import StaggerGroup from "@/components/motion/StaggerGroup";
import StaggerItem from "@/components/motion/StaggerItem";
import { Server, Globe, Lock, Shield, Check } from "@/components/icons";
import f from "./featureShowcase.module.css";
import sec from "./security.module.css";

/* Icônes résolues côté client : une page Server Component ne peut pas passer
   de composant (fonction) en prop à un Client Component → on passe une clé. */
const ICONS = { Server, Globe, Lock, Shield } as const;

export type SecuritySection = {
  /** Clé de l'icône (résolue dans ICONS). */
  icon: keyof typeof ICONS;
  kicker: string;
  title: string;
  text: string;
  points: string[];
  /** Photo affichée dans la colonne visuelle (chemin sous /public). */
  image: string;
  alt: string;
  tone?: "white" | "soft" | "medium" | "dark";
  reverse?: boolean;
};

/**
 * Section détaillée de la page Sécurité : texte (gauche/droite) + photo
 * encadrée. Calquée sur FeatureShowcase, mais montre une vraie photo serveurs
 * au lieu d'un mockup d'app. Réutilise featureShowcase.module.css pour le texte
 * et security.module.css pour le cadre photo.
 */
export default function SecurityShowcase({
  icon,
  kicker,
  title,
  text,
  points,
  image,
  alt,
  tone = "white",
  reverse = false,
}: SecuritySection) {
  const Icon = ICONS[icon];

  const toneCls =
    tone === "soft"
      ? "tone-soft"
      : tone === "medium"
        ? "tone-medium"
        : tone === "dark"
          ? f.dark
          : "tone-white";

  const dark = tone === "dark";

  // Sur une section foncée, la photo locale fait office de fond immersif.
  const style = dark
    ? ({ "--showcase-img": `url("${image}")` } as CSSProperties)
    : undefined;

  return (
    <section className={`${f.showcase} ${toneCls}`} style={style}>
      <div className={`wrap ${f.grid} ${reverse ? f.reverse : ""}`}>
        <Reveal
          variant={reverse ? "right" : "left"}
          className={`${f.text} ${reverse ? sec.secTextReverse : sec.secText}`}
        >
          <div className={f.iconRow}>
            <span className={f.icon}>
              <Icon width={26} height={26} />
            </span>
            <span className={f.kicker}>{kicker}</span>
          </div>
          <h2 className={f.title}>{title}</h2>
          <p className={f.lead}>{text}</p>
          <StaggerGroup as="ul" className={f.points}>
            {points.map((point) => (
              <StaggerItem as="li" key={point} variant="up">
                <span className={f.tick}>
                  <Check width={13} height={13} />
                </span>
                {point}
              </StaggerItem>
            ))}
          </StaggerGroup>
        </Reveal>

        <Parallax
          amount={20}
          className={`${f.visual} ${reverse ? sec.secVisualReverse : sec.secVisual}`}
        >
          <div
            className={`${sec.photoFrame} ${dark ? sec.photoFrameDark : ""}`}
          >
            <Image
              src={image}
              alt={alt}
              fill
              sizes="(max-width: 980px) 100vw, 560px"
            />
          </div>
        </Parallax>
      </div>
    </section>
  );
}
