import Link from "next/link";
import Reveal from "@/components/motion/Reveal";
import { ShieldCheck, Wallet, Clock, ArrowRight } from "@/components/icons";
import { resolveHref } from "@/lib/appLinks";
import type { SectionContentOf } from "@/lib/cms/sections.schema";
import f from "@/components/featureShowcase.module.css";

/* Icônes des pastilles de confiance (clés string du contenu CMS). */
const ICONS = { ShieldCheck, Wallet, Clock } as const;

/**
 * Panneau CTA spectaculaire de fin de page (sections `cta_panel`) — recette
 * partagée des anciens HomeCta/FeaturesCta/SecuriteCta/AvantagesCta.
 */
export default function CtaPanel({
  content,
}: {
  content: SectionContentOf<"cta_panel">;
}) {
  return (
    <section className={f.ctaSec}>
      <div className="wrap">
        <Reveal variant="scale" className={f.ctaPanel}>
          <div className={f.ctaGlow} />
          <div className={f.ctaContent}>
            <div className={f.ctaKicker}>{content.kicker}</div>
            <h2 className={f.ctaTitle}>{content.title}</h2>
            <p className={f.ctaLead}>{content.lead}</p>
            <div className={f.ctaActions}>
              <a
                href={resolveHref(content.primary.href)}
                className={f.ctaBtnPrimary}
              >
                {content.primary.label} <ArrowRight width={18} height={18} />
              </a>
              <Link href={content.secondary.href} className={f.ctaBtnGhost}>
                {content.secondary.label}
              </Link>
            </div>
            {content.trust && (
              <div className={f.ctaTrust}>
                {content.trust.map(({ icon, label }) => {
                  const Icon = ICONS[icon as keyof typeof ICONS];
                  return (
                    <span className={f.ctaTrustItem} key={label}>
                      <Icon width={16} height={16} /> {label}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
