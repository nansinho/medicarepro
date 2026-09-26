"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Apparitions au défilement (IntersectionObserver), après hydratation.
 *
 * - [data-rv-kit], [data-rv-post] : le bloc monte légèrement en fondu la
 *   première fois qu'il entre à l'écran.
 * - [data-anim] (visuels, formes de bord, listes) : sous la ligne de
 *   flottaison, le bloc est mis en attente (data-wait, masqué) puis
 *   reçoit `in` et ses pièces s'animent une fois (CSS). Ceux déjà à
 *   l'écran, ou jamais vus par ce script, restent simplement posés ; le
 *   haut de page s'anime seul, en CSS ([data-hero]).
 *
 * Rien ne bouge ensuite. Respecte prefers-reduced-motion ; sans script,
 * tout reste visible. Se ré-exécute à chaque changement de page pour
 * observer les éléments rendus en navigation client.
 */
export default function ScrollEffects() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let io: IntersectionObserver | null = null;
    let ioAnim: IntersectionObserver | null = null;
    const onEnter = (entries: IntersectionObserverEntry[], obs: IntersectionObserver) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          const el = e.target as HTMLElement;
          el.classList.add("in");
          obs.unobserve(el);
          /* Le décalage d'apparition ne doit pas retarder ensuite les
             réponses au survol. */
          if (el.style.transitionDelay) {
            window.setTimeout(() => {
              el.style.transitionDelay = "";
            }, 1400);
          }
        }
      });
    };
    try {
      io = new IntersectionObserver(onEnter, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
      ioAnim = new IntersectionObserver(onEnter, { threshold: 0.18, rootMargin: "0px 0px -6% 0px" });
    } catch {
      return;
    }

    const inView = (el: Element) => el.getBoundingClientRect().top < window.innerHeight * 0.92;

    const reveal = (sel: string, type = "", stagger = 0) => {
      document.querySelectorAll<HTMLElement>(sel).forEach((el, i) => {
        /* Déjà à l'écran au chargement : on ne le cache pas. Un visuel
           s'anime lui-même : sa colonne ne bouge pas en plus. */
        if (inView(el) || el.querySelector('[data-anim="vis"]')) return;
        el.setAttribute("data-rv", type);
        el.style.transitionDelay = (i % 4) * stagger + "ms";
        io?.observe(el);
      });
    };

    reveal("[data-rv-kit]", "", 70);
    reveal("[data-rv-post]", "", 90);

    document.querySelectorAll<HTMLElement>("[data-anim]").forEach((el) => {
      if (el.classList.contains("in") || el.closest("[data-hero]")) return;
      if (inView(el)) {
        /* Mis en attente lors d'un passage précédent : on le libère. */
        if (el.hasAttribute("data-wait")) el.classList.add("in");
        return;
      }
      el.setAttribute("data-wait", "");
      ioAnim?.observe(el);
    });

    return () => {
      io?.disconnect();
      ioAnim?.disconnect();
    };
  }, [pathname]);

  return null;
}
