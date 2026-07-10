"use client";

import { motion } from "framer-motion";
import { EASE } from "@/components/motion/motion";
import { BadgeCheck, Shield, Lock, Globe } from "@/components/icons";
import OvhBadge from "@/components/OvhBadge";
import { emphasize } from "@/components/cms/inline";
import type { SectionContentOf } from "@/lib/cms/sections.schema";
import s from "./security.module.css";

/* Icônes des mini-badges de confiance (clés string du contenu CMS). */
const ICONS = { BadgeCheck, Shield, Lock, Globe } as const;

/**
 * Hero cinématique de la page Sécurité : porte l'UNIQUE <h1>, photo serveurs
 * en filigrane, texte centré animé à l'entrée + rangée de badges de confiance.
 */
export default function SecurityHero({
  content,
}: {
  content: SectionContentOf<"page_hero">;
}) {
  return (
    <section className={s.hero}>
      <OvhBadge />
      <div className={`wrap ${s.heroInner}`}>
        <motion.div
          className={s.heroText}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: EASE }}
        >
          <div className="kicker">{content.kicker}</div>
          <h1 className={s.heroTitle}>
            {emphasize(content.title, (segment, key) => (
              <span key={key} className={s.heroAccent}>
                {segment}
              </span>
            ))}
          </h1>
          <p className={s.heroLead}>{content.lead}</p>
          {content.trust && (
            <motion.div
              className={s.trustRow}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.25 }}
            >
              {content.trust.map(({ icon, label }) => {
                const Icon = ICONS[icon as keyof typeof ICONS];
                return (
                  <span className={s.trustBadge} key={label}>
                    <Icon width={18} height={18} />
                    {label}
                  </span>
                );
              })}
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
