import type { CSSProperties } from "react";
import s from "./BrandLogo.module.css";

/* ============================================================
   Marque MediCare Pro (charte graphique 2026) : pictogramme
   officiel + « MEDICARE » en capitales, « PRO » plus petit en
   exposant. Le logo est servi tel qu'il est dessiné dans le kit
   (public/brand/svg, texte vectorisé) : identique partout, sans
   dépendre d'une police. Server-safe (aucun hook).
   ============================================================ */

/** Proportions du logo horizontal (largeur / hauteur du fichier SVG). */
const RATIO = 1332.5 / 300;

type Props = {
  /** Hauteur du logo en px (= hauteur du pictogramme). */
  size?: number;
  /** "light" = fond sombre : texte blanc. "auto" = suit le thème du back office. */
  variant?: "dark" | "light" | "auto";
  className?: string;
};

export default function BrandLogo({ size = 38, variant = "dark", className }: Props) {
  const onLight = "/brand/svg/medicarepro-logo-horizontal.svg";
  const onDark = "/brand/svg/medicarepro-logo-horizontal-fond-sombre.svg";
  return (
    <span
      className={`${s.brand} ${variant === "auto" ? s.auto : ""} ${className ?? ""}`}
      style={{ "--brand-size": `${size}px` } as CSSProperties}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG vectoriel : next/image ne l'optimiserait pas */}
      <img
        src={variant === "light" ? onDark : onLight}
        alt="MediCare Pro"
        width={Math.round(size * RATIO)}
        height={size}
        className={`${s.logo} ${variant === "auto" ? s.onLight : ""}`}
      />
      {variant === "auto" && (
        /* eslint-disable-next-line @next/next/no-img-element -- SVG vectoriel */
        <img
          src={onDark}
          alt=""
          aria-hidden="true"
          width={Math.round(size * RATIO)}
          height={size}
          className={`${s.logo} ${s.onDark}`}
        />
      )}
    </span>
  );
}
