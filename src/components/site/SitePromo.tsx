import Link from "next/link";
import type { ReactNode } from "react";
import { resolveHref } from "@/lib/appLinks";
import { ArrowRight } from "@/components/icons";
import { fr } from "./Kit";
import c from "./chrome.module.css";

type Promo = {
  enabled: boolean;
  text: string;
  href: string;
  linkLabel: string;
};

/** `**…**` = gras, `~~…~~` = prix barré. Aucun HTML interprété. */
function promoText(text: string): ReactNode {
  return fr(text).split(/(\*\*.+?\*\*|~~.+?~~)/g).map((seg, i) => {
    if (seg.startsWith("**") && seg.endsWith("**")) return <b key={i}>{seg.slice(2, -2)}</b>;
    if (seg.startsWith("~~") && seg.endsWith("~~")) return <s key={i}>{seg.slice(2, -2)}</s>;
    return seg;
  });
}

/**
 * Bandeau promotionnel au-dessus de l'en-tête (réglage `promoBanner` du back
 * office) : bleu nuit, montants en ambre, filet aux couleurs du logo. Dans le
 * flux de la page : il défile avec elle.
 */
export default function SitePromo({ promo }: { promo: Promo }) {
  if (!promo.enabled || !promo.text.trim()) return null;
  const href = promo.href.trim();
  return (
    <div className={c.promo} role="region" aria-label="Offre du moment">
      <div className={c.w}>
        <span>{promoText(promo.text)}</span>
        {href !== "" && (
          <Link href={resolveHref(href)} className={c.promoBtn}>
            {promo.linkLabel.trim() || "En savoir plus"}
            <ArrowRight aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  );
}
