"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import Reveal from "@/components/motion/Reveal";
import Parallax from "@/components/motion/Parallax";
import StaggerGroup from "@/components/motion/StaggerGroup";
import StaggerItem from "@/components/motion/StaggerItem";
import AppMockup, { type MockupKind } from "@/components/motion/AppMockup";
import {
  Layers,
  Sparkles,
  Zap,
  FileText,
  ShieldCheck,
  Grid,
  Clock,
  ShieldPlus,
  Star,
  Check,
} from "@/components/icons";
import f from "./featureShowcase.module.css";
import sec from "./security.module.css";

/* Icônes résolues côté client : une page Server Component ne peut pas passer
   de composant (fonction) en prop à un Client Component → on passe une clé.
   Map partagé par les pages Avantages et Bilans. */
const ICONS = {
  Layers,
  Sparkles,
  Zap,
  FileText,
  ShieldCheck,
  Grid,
  Clock,
  ShieldPlus,
  Star,
} as const;

export type AvantageSection = {
  /** Clé de l'icône (résolue dans ICONS). */
  icon: keyof typeof ICONS;
  kicker: string;
  title: string;
  text: string;
  points: string[];
  /** Visuel de la colonne : mockup animé (préféré) OU photo.
      - `mockup` : écran d'app animé (sections claires).
      - `image`  : photo (obligatoire pour les sections "dark", sert de fond). */
  mockup?: MockupKind;
  image?: string;
  alt?: string;
  tone?: "white" | "soft" | "medium" | "dark";
  reverse?: boolean;
};

/**
 * Section détaillée de la page Avantages : texte (gauche/droite) + photo
 * encadrée. Calquée sur SecurityShowcase. Réutilise featureShowcase.module.css
 * pour le texte et security.module.css pour le cadre photo et l'alignement.
 */
export default function AvantagesShowcase({
  icon,
  kicker,
  title,
  text,
  points,
  mockup,
  image,
  alt,
  tone = "white",
  reverse = false,
}: AvantageSection) {
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
  const style =
    dark && image
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
          {mockup ? (
            <AppMockup kind={mockup} />
          ) : (
            <div
              className={`${sec.photoFrame} ${dark ? sec.photoFrameDark : ""}`}
            >
              <Image
                src={image ?? ""}
                alt={alt ?? ""}
                fill
                sizes="(max-width: 980px) 100vw, 560px"
              />
            </div>
          )}
        </Parallax>
      </div>
    </section>
  );
}
