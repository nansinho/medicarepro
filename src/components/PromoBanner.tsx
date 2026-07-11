import Link from "next/link";
import { resolveHref } from "@/lib/appLinks";
import { ArrowRight } from "@/components/icons";
import styles from "./PromoBanner.module.css";

/* ============================================================
   Bandeau promotionnel au-dessus du header (réglage promoBanner
   du back office). Le header étant fixed top:0, le bandeau est
   fixé lui aussi et pousse header + contenu via --promo-offset
   (consommée par Header.module.css et globals.css).
   ============================================================ */

type Promo = {
  enabled: boolean;
  text: string;
  href: string;
  linkLabel: string;
};

export default function PromoBanner({ promo }: { promo: Promo }) {
  if (!promo.enabled || !promo.text.trim()) return null;

  const href = promo.href.trim();

  return (
    <>
      {/* Décale header + page de la hauteur du bandeau. */}
      <style>{`:root{--promo-offset:42px}@media (max-width:760px){:root{--promo-offset:38px}}`}</style>
      <div className={styles.promo} role="region" aria-label="Annonce">
        <p className={styles.text}>
          {promo.text}
          {href !== "" && (
            <Link href={resolveHref(href)} className={styles.link}>
              {promo.linkLabel.trim() || "En savoir plus"}
              <ArrowRight width={13} height={13} />
            </Link>
          )}
        </p>
      </div>
    </>
  );
}
