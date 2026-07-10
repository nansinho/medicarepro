"use client";

import { motion } from "framer-motion";
import { EASE } from "@/components/motion/motion";
import { Star } from "@/components/icons";
import { emphasize, lines } from "@/components/cms/inline";
import type { SectionContentOf } from "@/lib/cms/sections.schema";
import s from "./featuresHero.module.css";

/**
 * Hero cinématique de la page Bilans : porte l'UNIQUE <h1>, texte centré
 * animé à l'entrée. Réutilise featuresHero.module.css (même dégradé / rythme)
 * et ajoute le badge d'exclusivité animé.
 */
export default function BilansHero({
  content,
}: {
  content: SectionContentOf<"page_hero">;
}) {
  return (
    <section className={`${s.hero} ${s.heroBilans}`}>
      <div className={`wrap ${s.inner}`}>
        <motion.div
          className={s.text}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: EASE }}
        >
          {content.badge && (
            <motion.span
              className={s.badge}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
            >
              <Star width={14} height={14} /> {content.badge}
            </motion.span>
          )}
          <h1 className={s.title}>
            {emphasize(content.title, (segment, key) => (
              <span key={key} className={s.accent}>
                {segment}
              </span>
            ))}
          </h1>
          <p className={s.lead}>
            {lines(content.lead, {
              /* Saut de ligne masqué en mobile (pas d'espace de repli ici,
                 fidèle au rendu d'origine). */
              br: (key) => <br key={key} className={s.breakLg} />,
            })}
          </p>
        </motion.div>
      </div>
    </section>
  );
}
