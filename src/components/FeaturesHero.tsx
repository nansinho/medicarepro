"use client";

import { Fragment } from "react";
import { motion } from "framer-motion";
import { EASE } from "@/components/motion/motion";
import { lines } from "@/components/cms/inline";
import type { SectionContentOf } from "@/lib/cms/sections.schema";
import s from "./featuresHero.module.css";

/**
 * Hero cinématique de la page Fonctionnalités : porte l'UNIQUE <h1>,
 * texte centré animé à l'entrée.
 */
export default function FeaturesHero({
  content,
}: {
  content: SectionContentOf<"page_hero">;
}) {
  return (
    <section className={s.hero}>
      <div className={`wrap ${s.inner}`}>
        <motion.div
          className={s.text}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: EASE }}
        >
          <div className="kicker">{content.kicker}</div>
          <h1 className={s.title}>
            {lines(content.title, {
              accent: (segment, key) => (
                <span key={key} className={s.accent}>
                  {segment}
                </span>
              ),
            })}
          </h1>
          <p className={s.lead}>
            {lines(content.lead, {
              /* Saut de ligne masqué en mobile + espace de repli. */
              br: (key) => (
                <Fragment key={key}>
                  <br className={s.breakLg} />{" "}
                </Fragment>
              ),
            })}
          </p>
        </motion.div>
      </div>
    </section>
  );
}
