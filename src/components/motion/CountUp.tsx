"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";
import { useIsReduced } from "./motion";

type CountUpProps = {
  /** Valeur cible. */
  to: number;
  /** Durée de l'animation (s). */
  duration?: number;
  /** Préfixe (ex. "+", "−"). */
  prefix?: string;
  /** Suffixe (ex. " €", " %"). */
  suffix?: string;
  /** Nombre de décimales. */
  decimals?: number;
  className?: string;
};

/** Format français : espace fine comme séparateur de milliers, virgule décimale. */
function formatFr(value: number, decimals: number) {
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Compteur animé déclenché à l'entrée dans le viewport.
 * Sous prefers-reduced-motion : affiche directement la valeur finale.
 */
export default function CountUp({
  to,
  duration = 1.7,
  prefix = "",
  suffix = "",
  decimals = 0,
  className,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const reduced = useIsReduced();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setValue(to);
      return;
    }
    let raf = 0;
    let start: number | null = null;
    const ms = duration * 1000;
    const tick = (now: number) => {
      if (start === null) start = now;
      const p = Math.min(1, (now - start) / ms);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(to * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setValue(to);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduced, to, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {formatFr(value, decimals)}
      {suffix}
    </span>
  );
}
