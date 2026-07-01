"use client";

import { motion } from "framer-motion";
import { EASE } from "@/components/motion/motion";
import s from "./featuresHero.module.css";

/**
 * Hero cinématique de la page Fonctionnalités : porte l'UNIQUE <h1>,
 * texte centré animé à l'entrée.
 */
export default function FeaturesHero() {
  return (
    <section className={s.hero}>
      <div className={`wrap ${s.inner}`}>
        <motion.div
          className={s.text}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: EASE }}
        >
          <div className="kicker">Fonctionnalités</div>
          <h1 className={s.title}>
            Tout votre cabinet,
            <br />
            <span className={s.accent}>automatisé.</span>
          </h1>
          <p className={s.lead}>
            Facturation, signature, comptabilité, agenda, bilans et application
            mobile.
            <br className={s.breakLg} />{" "}
            Six outils premium réunis, à partir de 24,84 €/mois.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
