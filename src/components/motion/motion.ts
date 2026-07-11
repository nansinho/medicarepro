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

/** Durées resserrées sur mobile (s) — miroir du bloc [data-rv] ≤760 de globals.css. */
export const DUR_MOBILE = {
  fast: 0.4,
  base: 0.65,
  slow: 0.7,
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

/**
 * Partie transform du décalage d'apparition, resserrée sur mobile
 * (miroir du bloc [data-rv] ≤760 de globals.css).
 *
 * Exposée séparément pour être passée au prop `style` des composants
 * framer-motion : contrairement à `initial` (résolu une seule fois au
 * montage, où useIsMobile vaut encore false — SSR compris), les transforms
 * du style sont relus à chaque rendu tant que la valeur n'a pas été animée.
 * Le resserrage mobile prend donc effet juste après l'hydratation, avant
 * l'entrée en vue, sans mismatch d'hydratation ; et une fois le reveal
 * joué, les changements de style sont ignorés (pas de saut au resize).
 */
export function revealTransform(variant: RevealVariant, mobile = false) {
  switch (variant) {
    case "scale":
      return mobile ? { y: 18, scale: 0.96 } : { y: 30, scale: 0.93 };
    case "left":
      return { x: mobile ? -28 : -56 };
    case "right":
      return { x: mobile ? 28 : 56 };
    case "up":
    default:
      return { y: mobile ? 24 : 46 };
  }
}

/** Décalage d'apparition complet (opacité + transform). */
export function revealOffset(variant: RevealVariant, mobile = false) {
  return { opacity: 0, ...revealTransform(variant, mobile) };
}
