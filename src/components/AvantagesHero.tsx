"use client";

import { motion } from "framer-motion";
import { EASE } from "@/components/motion/motion";
import { Layers, Sparkles, Clock, Wallet } from "@/components/icons";
import { emphasize } from "@/components/cms/inline";
import type { SectionContentOf } from "@/lib/cms/sections.schema";
import s from "./security.module.css";
import a from "./avantages.module.css";

/* Icônes des mini-badges (clés string du contenu CMS). */
const ICONS = { Layers, Sparkles, Clock, Wallet } as const;

/**
 * Hero cinématique de la page Avantages : porte l'UNIQUE <h1>, photo app en
 * filigrane, texte centré animé à l'entrée + rangée de mini-badges.
 * Réutilise la structure du hero sécurité (security.module.css) et son propre
 * fond (avantages.module.css).
 */
export default function AvantagesHero({
  content,
}: {
  content: SectionContentOf<"page_hero">;
}) {
  return (
    <section className={a.hero}>
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
