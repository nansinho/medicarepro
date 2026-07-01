"use client";

import { motion } from "framer-motion";
import { EASE } from "@/components/motion/motion";
import { Star } from "@/components/icons";
import s from "./featuresHero.module.css";

/**
 * Hero cinématique de la page Bilans : porte l'UNIQUE <h1>, texte centré
 * animé à l'entrée. Réutilise featuresHero.module.css (même dégradé / rythme)
 * et ajoute le badge d'exclusivité animé.
 */
export default function BilansHero() {
  return (
    <section className={`${s.hero} ${s.heroBilans}`}>
      <div className={`wrap ${s.inner}`}>
        <motion.div
          className={s.text}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: EASE }}
        >
          <motion.span
            className={s.badge}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
          >
            <Star width={14} height={14} /> Exclusivité MediCare Pro
          </motion.span>
          <h1 className={s.title}>
            13 bilans podologiques normés,{" "}
            <span className={s.accent}>scores calculés pour vous.</span>
          </h1>
          <p className={s.lead}>
            Bilans cliniques complets, grilles validées et recommandations.
            <br className={s.breakLg} /> Aucun autre logiciel ne propose autant
            d&apos;évaluations spécialisées.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
