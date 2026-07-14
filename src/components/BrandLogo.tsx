import type { CSSProperties } from "react";
import s from "./BrandLogo.module.css";

/* ============================================================
   Marque MediCare Pro : pictogramme officiel 2026 (croix + étoile
   + orbites) et nom écrit en texte — net à toutes les tailles,
   « Pro » en bleu marque. Server-safe (aucun hook).
   ============================================================ */

type Props = {
  /** Hauteur du pictogramme en px — le texte suit proportionnellement. */
  size?: number;
  /** "light" = fond sombre : pastille blanche sous l'icône, nom en blanc. */
  variant?: "dark" | "light";
  className?: string;
};

export default function BrandLogo({
  size = 38,
  variant = "dark",
  className,
}: Props) {
  return (
    <span
      className={`${s.brand} ${variant === "light" ? s.light : ""} ${className ?? ""}`}
      style={{ "--brand-size": `${size}px` } as CSSProperties}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG statique : next/image ne l'optimiserait pas */}
      <img
        src="/logo-icon.svg?v=7"
        alt=""
        width={size}
        height={size}
        className={s.icon}
      />
      <span className={s.name}>
        MediCare&nbsp;<span className={s.pro}>Pro</span>
      </span>
    </span>
  );
}
