"use client";

import { Star } from "./icons";
import { resolveHref } from "@/lib/appLinks";
import s from "./SideTabs.module.css";

/* Icône de l'onglet « avis » (clé string des réglages CMS).
   L'onglet « je m'abonne » utilise le pictogramme de marque (voir plus bas). */
const ICONS = { Star } as const;

/** Un onglet latéral (réglage `sideTabs` de site_settings). */
type SideTab = { label: string; href: string; icon: string };

/**
 * Onglets latéraux fixes et clignotants, présents sur toute la vitrine :
 * - gauche : « Laissez un avis » (lien Google Avis à brancher plus tard)
 * - droit  : « Je m'abonne » → passerelle vers l'app (app.medicarepro.fr/register)
 */
export default function SideTabs({
  tabs,
}: {
  tabs: { review: SideTab; subscribe: SideTab };
}) {
  const ReviewIcon = ICONS[tabs.review.icon as keyof typeof ICONS];
  return (
    <>
      <a
        href={resolveHref(tabs.review.href)}
        className={`${s.tab} ${s.left}`}
        aria-label={tabs.review.label}
      >
        <ReviewIcon className={s.ico} width={18} height={18} />
        <span className={s.label}>{tabs.review.label}</span>
      </a>

      <a
        href={resolveHref(tabs.subscribe.href)}
        target="_blank"
        rel="noopener noreferrer"
        className={`${s.tab} ${s.right}`}
        aria-label={tabs.subscribe.label}
      >
        {/* Pictogramme officiel MediCare Pro (pastille blanche pour ressortir sur le bleu). */}
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG statique : next/image ne l'optimiserait pas */}
        <img
          src="/logo-icon.svg?v=7"
          alt=""
          width={22}
          height={22}
          className={s.logo}
        />
        <span className={s.label}>{tabs.subscribe.label}</span>
      </a>
    </>
  );
}
