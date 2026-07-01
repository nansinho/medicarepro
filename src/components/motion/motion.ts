"use client";

import { useEffect, useState } from "react";

/** Easing maison (= var(--ease) cubic-bezier(0.16, 1, 0.3, 1)). */
export const EASE = [0.16, 1, 0.3, 1] as const;

/** Durées standard (s). */
export const DUR = {
  fast: 0.5,
  base: 0.8,
  slow: 1.05,
} as const;

/** Décalage entre enfants d'un groupe échelonné (s). */
export const STAGGER = 0.09;

/** Marge d'apparition (équiv. rootMargin "0px 0px -8% 0px"). */
export const VIEWPORT_MARGIN = "0px 0px -8% 0px";

/**
 * Vrai quand l'utilisateur préfère réduire les animations.
 * SSR-safe : false au premier rendu serveur, recalculé au montage.
 */
export function useIsReduced() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/**
 * Vrai sous le breakpoint mobile (parallax/tilt désactivés en dessous).
 * SSR-safe.
 */
export function useIsMobile(maxWidth = 760) {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    setMobile(mq.matches);
    const onChange = () => setMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [maxWidth]);
  return mobile;
}

/** Variants de Reveal selon la direction. */
export type RevealVariant = "up" | "scale" | "left" | "right";

export function revealOffset(variant: RevealVariant) {
  switch (variant) {
    case "scale":
      return { opacity: 0, y: 30, scale: 0.93 };
    case "left":
      return { opacity: 0, x: -56 };
    case "right":
      return { opacity: 0, x: 56 };
    case "up":
    default:
      return { opacity: 0, y: 46 };
  }
}
