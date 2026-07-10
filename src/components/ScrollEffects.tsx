"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Effets globaux pilotés côté client, après hydratation :
 *  - barre de progression de scroll
 *  - apparitions au scroll (IntersectionObserver), échelonnées
 *  - boutons magnétiques
 * Respecte prefers-reduced-motion.
 * Se ré-exécute à chaque changement de page (pathname) pour ré-observer
 * les nouveaux éléments rendus en navigation client.
 */
export default function ScrollEffects() {
  const pathname = usePathname();

  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduce) return;

    const cleanups: Array<() => void> = [];

    // --- Barre de progression de scroll ---
    const prog = document.createElement("div");
    prog.id = "progress";
    document.body.appendChild(prog);
    let ticking = false;
    const frame = () => {
      const h = document.documentElement;
      prog.style.width =
        (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100 + "%";
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(frame);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    cleanups.push(() => {
      window.removeEventListener("scroll", onScroll);
      prog.remove();
    });

    // --- Apparitions au scroll ---
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    const reveal = (sel: string, type = "", stagger = 0) => {
      document.querySelectorAll<HTMLElement>(sel).forEach((el, i) => {
        el.setAttribute("data-rv", type);
        el.style.transitionDelay = (i % 6) * stagger + "ms";
        io.observe(el);
      });
    };

    reveal(".sec-head", "", 0);
    reveal("[data-rv-value]", "scale", 110);
    reveal("[data-rv-price]", "scale", 0);
    reveal("[data-rv-savecompare]", "scale", 0);
    reveal("[data-rv-saveresult]", "", 0);
    reveal("[data-rv-savestat]", "scale", 90);
    reveal("[data-rv-cta]", "scale", 0);
    reveal("[data-rv-post]", "", 120);
    // La FAQ gère son apparition au scroll dans son propre composant (Faq.tsx),
    // sinon les re-renders au clic écraseraient la classe de révélation.
    reveal("[data-rv-footcol]", "", 85);
    cleanups.push(() => io.disconnect());

    // --- Boutons magnétiques ---
    const buttons = document.querySelectorAll<HTMLElement>(".btn");
    const handlers: Array<{
      el: HTMLElement;
      move: (e: MouseEvent) => void;
      leave: () => void;
    }> = [];
    buttons.forEach((b) => {
      const move = (e: MouseEvent) => {
        const r = b.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        b.style.transform = `translate(${x * 0.22}px, ${y * 0.34}px)`;
      };
      const leave = () => {
        b.style.transform = "";
      };
      b.addEventListener("mousemove", move);
      b.addEventListener("mouseleave", leave);
      handlers.push({ el: b, move, leave });
    });
    cleanups.push(() => {
      handlers.forEach(({ el, move, leave }) => {
        el.removeEventListener("mousemove", move);
        el.removeEventListener("mouseleave", leave);
      });
    });

    return () => cleanups.forEach((fn) => fn());
  }, [pathname]);

  return null;
}
