import type { CSSProperties, SVGProps } from "react";

/* ============================================================
   Symboles tirés du logo MediCare Pro : l'étoile à quatre
   branches (puces), la croix arrondie (formes derrière photos
   et écrans), l'angle de croix (blocs d'offre).
   ============================================================ */

type P = SVGProps<SVGSVGElement>;

/** Étoile à quatre branches du pictogramme (puce des listes). */
export function StarMark(props: P) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M12 1.5C12.8 7 17 11.2 22.5 12 17 12.8 12.8 17 12 22.5 11.2 17 7 12.8 1.5 12 7 11.2 11.2 7 12 1.5Z"
      />
    </svg>
  );
}

/** Croix arrondie du pictogramme, en aplat. */
export function CrossMark({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={className}
      style={style}
    >
      <path
        d="M50 21V79M21 50H79"
        stroke="currentColor"
        strokeWidth="32"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/** Angle de croix (forme en L arrondie) qui dépasse d'un bloc. */
export function CornerMark({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={className}
      style={style}
    >
      <path
        d="M18 100V52Q18 18 52 18H100"
        stroke="currentColor"
        strokeWidth="30"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/** Flèche dessinée à la main (désigne la carte mise en avant du hero). */
export function DrawnArrow({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 70"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M8 62C18 26 58 8 100 22"
        pathLength={1}
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M82 8l22 14-20 16"
        pathLength={1}
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
