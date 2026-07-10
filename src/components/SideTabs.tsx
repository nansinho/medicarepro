"use client";

import { Star, ShieldPlus } from "./icons";
import { resolveHref } from "@/lib/appLinks";
import s from "./SideTabs.module.css";

/* Icônes des onglets (clés string des réglages CMS). */
const ICONS = { Star, ShieldPlus } as const;

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
  const SubscribeIcon = ICONS[tabs.subscribe.icon as keyof typeof ICONS];
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
        <SubscribeIcon className={s.ico} width={18} height={18} />
        <span className={s.label}>{tabs.subscribe.label}</span>
      </a>
    </>
  );
}
