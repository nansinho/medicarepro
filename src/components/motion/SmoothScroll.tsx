"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";

/**
 * Smooth scroll global (Lenis), monté une fois dans le layout (site).
 * - Désactivé sous prefers-reduced-motion (scroll natif).
 * - Désactivé sous 760px (perf mobile : scroll natif).
 * - Remet le scroll en haut à chaque changement de page.
 * Rend `null` (agit globalement sur le scroll, pas de wrapper DOM).
 */
export default function SmoothScroll() {
  const pathname = usePathname();

  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const isMobile = window.matchMedia("(max-width: 760px)").matches;
    if (reduce || isMobile) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      anchors: true,
    });

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  // Remonte en haut à chaque navigation (Lenis ne le fait pas seul).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
