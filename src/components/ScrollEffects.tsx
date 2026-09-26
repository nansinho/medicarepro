"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Apparitions douces au défilement (IntersectionObserver), après
 * hydratation : les blocs marqués montent légèrement en fondu la première
 * fois qu'ils entrent à l'écran. Rien ne bouge ensuite.
 * Respecte prefers-reduced-motion ; sans observateur, tout reste visible.
 * Se ré-exécute à chaque changement de page pour observer les nouveaux
 * éléments rendus en navigation client.
 */
export default function ScrollEffects() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let io: IntersectionObserver | null = null;
    try {
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add("in");
              io?.unobserve(e.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
      );
    } catch {
      return;
    }

    const reveal = (sel: string, type = "", stagger = 0) => {
      document.querySelectorAll<HTMLElement>(sel).forEach((el, i) => {
        /* Déjà à l'écran au chargement : on ne le cache pas. */
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight * 0.92) return;
        el.setAttribute("data-rv", type);
        el.style.transitionDelay = (i % 4) * stagger + "ms";
        io?.observe(el);
      });
    };

    reveal("[data-rv-kit]", "", 70);
    reveal("[data-rv-post]", "", 90);

    return () => io?.disconnect();
  }, [pathname]);

  return null;
}
