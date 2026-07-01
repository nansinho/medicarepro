"use client";

import { Star, ShieldPlus } from "./icons";
import s from "./SideTabs.module.css";

/**
 * Onglets latéraux fixes et clignotants, présents sur toute la vitrine :
 * - gauche : « Laissez un avis » (lien Google Avis à brancher plus tard)
 * - droit  : « Je m'abonne » → passerelle vers l'app (app.medicarepro.fr/register)
 */
export default function SideTabs() {
  return (
    <>
      <a
        href="#"
        className={`${s.tab} ${s.left}`}
        aria-label="Laissez un avis"
      >
        <Star className={s.ico} width={18} height={18} />
        <span className={s.label}>Laissez un avis</span>
      </a>

      <a
        href="https://app.medicarepro.fr/register"
        target="_blank"
        rel="noopener noreferrer"
        className={`${s.tab} ${s.right}`}
        aria-label="Je m'abonne"
      >
        <ShieldPlus className={s.ico} width={18} height={18} />
        <span className={s.label}>Je m&apos;abonne</span>
      </a>
    </>
  );
}
