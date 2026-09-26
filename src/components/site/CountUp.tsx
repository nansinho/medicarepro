"use client";

import { useEffect, useRef } from "react";

/**
 * Chiffre qui défile de 0 à sa valeur à son entrée à l'écran.
 * Le serveur rend la valeur finale (moteurs, lecteurs d'écran, sans
 * script) ; le défilement ne joue que si le chiffre est encore sous la
 * ligne de flottaison au chargement et que le mouvement est permis.
 */
export default function CountUp({
  to,
  decimals,
  prefix = "",
  suffix = "",
  children,
}: {
  to: number;
  decimals: number;
  prefix?: string;
  suffix?: string;
  /** Valeur finale formatée par le serveur. */
  children: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || to === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;

    const nf = new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    const show = (n: number) => {
      el.textContent = `${prefix}${nf.format(n)}${suffix}`;
    };
    show(0);

    let raf = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const t0 = performance.now();
        const dur = to > 100 ? 1500 : 1100;
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / dur);
          const eased = 1 - Math.pow(1 - p, 4);
          show(p < 1 ? (decimals ? to * eased : Math.round(to * eased)) : to);
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    io.observe(el);

    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      el.textContent = children;
    };
  }, [to, decimals, prefix, suffix, children]);

  return <b ref={ref}>{children}</b>;
}
