"use client";

import { motion } from "framer-motion";
import { EASE } from "@/components/motion/motion";
import { Layers, Sparkles, Clock, Wallet } from "@/components/icons";
import s from "./security.module.css";
import a from "./avantages.module.css";

/** Mini-badges affichés sous le lead du hero. */
const TRUST = [
  { icon: Layers, label: "Tout-en-un" },
  { icon: Sparkles, label: "Simple à prendre en main" },
  { icon: Clock, label: "Gain de temps" },
  { icon: Wallet, label: "Jusqu'à 260 €/mois économisés" },
];

/**
 * Hero cinématique de la page Avantages : porte l'UNIQUE <h1>, photo app en
 * filigrane, texte centré animé à l'entrée + rangée de mini-badges.
 * Réutilise la structure du hero sécurité (security.module.css) et son propre
 * fond (avantages.module.css).
 */
export default function AvantagesHero() {
  return (
    <section className={a.hero}>
      <div className={`wrap ${s.heroInner}`}>
        <motion.div
          className={s.heroText}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: EASE }}
        >
          <div className="kicker">Avantages</div>
          <h1 className={s.heroTitle}>
            Un seul logiciel,{" "}
            <span className={s.heroAccent}>tout votre cabinet simplifié.</span>
          </h1>
          <p className={s.heroLead}>
            Tout-en-un, simple, rapide et économique : voici pourquoi les
            podologues choisissent MediCare Pro pour gérer leur cabinet au
            quotidien — à partir de 24,84 €/mois, tout inclus.
          </p>
          <motion.div
            className={s.trustRow}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.25 }}
          >
            {TRUST.map(({ icon: Icon, label }) => (
              <span className={s.trustBadge} key={label}>
                <Icon width={18} height={18} />
                {label}
              </span>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
