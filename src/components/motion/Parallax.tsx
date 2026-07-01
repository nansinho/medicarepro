"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, type ReactNode } from "react";
import { useIsMobile, useIsReduced } from "./motion";

type ParallaxProps = {
  children: ReactNode;
  className?: string;
  /** Amplitude du déplacement vertical en px (positif = descend plus lentement). */
  amount?: number;
};

/**
 * Déplacement vertical lié au scroll (effet parallax).
 * Désactivé sous 760px et sous prefers-reduced-motion (rend statique).
 */
export default function Parallax({
  children,
  className,
  amount = 60,
}: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useIsReduced();
  const mobile = useIsMobile();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [amount, -amount]);

  if (reduced || mobile) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    );
  }

  return (
    <motion.div ref={ref} className={className} style={{ y }}>
      {children}
    </motion.div>
  );
}
