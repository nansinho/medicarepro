"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { STAGGER, VIEWPORT_MARGIN, useIsReduced } from "./motion";

type StaggerGroupProps = {
  children: ReactNode;
  className?: string;
  /** Décalage entre enfants (s). */
  stagger?: number;
  as?: "div" | "ul" | "section";
};

/**
 * Conteneur d'apparition échelonnée : ses <StaggerItem> enfants
 * apparaissent l'un après l'autre. Respecte prefers-reduced-motion.
 */
export default function StaggerGroup({
  children,
  className,
  stagger = STAGGER,
  as = "div",
}: StaggerGroupProps) {
  const reduced = useIsReduced();
  const MotionTag = motion[as];

  if (reduced) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, margin: VIEWPORT_MARGIN }}
      variants={{
        hidden: {},
        shown: { transition: { staggerChildren: stagger } },
      }}
    >
      {children}
    </MotionTag>
  );
}
