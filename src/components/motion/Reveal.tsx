"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import {
  DUR,
  DUR_MOBILE,
  EASE,
  VIEWPORT_MARGIN,
  revealOffset,
  revealTransform,
  useIsMobile,
  useIsReduced,
  type RevealVariant,
} from "./motion";

type RevealProps = {
  children: ReactNode;
  /** Direction de l'apparition. Défaut "up". */
  variant?: RevealVariant;
  /** Délai avant l'animation (s). */
  delay?: number;
  /** Classe sur le conteneur animé. */
  className?: string;
  /** Élément HTML rendu. Défaut "div". */
  as?: "div" | "section" | "li" | "article" | "span";
};

/**
 * Apparition au scroll (fade + translation), une seule fois.
 * Remplace le pattern data-rv / .in. Respecte prefers-reduced-motion
 * (rend l'enfant statique, sans transform).
 */
export default function Reveal({
  children,
  variant = "up",
  delay = 0,
  className,
  as = "div",
}: RevealProps) {
  const reduced = useIsReduced();
  const mobile = useIsMobile();
  const MotionTag = motion[as];

  if (reduced) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  // Le décalage passe aussi par `style` : `initial` est figé au montage
  // (mobile vaut false au 1er rendu) alors que les transforms du style sont
  // relus tant qu'ils n'ont pas été animés — voir revealTransform().
  return (
    <MotionTag
      className={className}
      style={revealTransform(variant, mobile)}
      initial={revealOffset(variant, mobile)}
      whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      viewport={{ once: true, margin: VIEWPORT_MARGIN }}
      transition={{ duration: mobile ? DUR_MOBILE.slow : DUR.slow, ease: EASE, delay }}
    >
      {children}
    </MotionTag>
  );
}
