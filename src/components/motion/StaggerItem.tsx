"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { DUR, EASE, revealOffset, useIsReduced, type RevealVariant } from "./motion";

type StaggerItemProps = {
  children: ReactNode;
  className?: string;
  variant?: RevealVariant;
  as?: "div" | "li" | "article";
};

/**
 * Enfant d'un <StaggerGroup>. Apparaît selon le rythme du parent.
 * Respecte prefers-reduced-motion (statique).
 */
export default function StaggerItem({
  children,
  className,
  variant = "scale",
  as = "div",
}: StaggerItemProps) {
  const reduced = useIsReduced();
  const MotionTag = motion[as];

  if (reduced) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  return (
    <MotionTag
      className={className}
      variants={{
        hidden: revealOffset(variant),
        shown: {
          opacity: 1,
          x: 0,
          y: 0,
          scale: 1,
          transition: { duration: DUR.base, ease: EASE },
        },
      }}
    >
      {children}
    </MotionTag>
  );
}
