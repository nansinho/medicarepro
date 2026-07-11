"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import {
  DUR,
  DUR_MOBILE,
  EASE,
  revealOffset,
  revealTransform,
  useIsMobile,
  useIsReduced,
  type RevealVariant,
} from "./motion";

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
  const mobile = useIsMobile();
  const MotionTag = motion[as];

  if (reduced) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  // Comme dans <Reveal> : le variant "hidden" est figé au montage, le
  // resserrage mobile passe donc par `style` — voir revealTransform().
  return (
    <MotionTag
      className={className}
      style={revealTransform(variant, mobile)}
      variants={{
        hidden: revealOffset(variant, mobile),
        shown: {
          opacity: 1,
          x: 0,
          y: 0,
          scale: 1,
          transition: { duration: mobile ? DUR_MOBILE.base : DUR.base, ease: EASE },
        },
      }}
    >
      {children}
    </MotionTag>
  );
}
