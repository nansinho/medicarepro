"use client";

import { motion } from "framer-motion";
import { EASE } from "@/components/motion/motion";
import { BadgeCheck, Shield, Lock, Globe, OvhLogo } from "@/components/icons";
import s from "./security.module.css";

/** Mini-badges de confiance affichés sous le lead du hero. */
const TRUST = [
  { icon: BadgeCheck, label: "Certifié HDS" },
  { icon: Shield, label: "Conforme RGPD" },
  { icon: Lock, label: "Chiffré de bout en bout" },
  { icon: Globe, label: "Données en France" },
];

/**
 * Pastille OVH flottante : disque vitré, logo OVH au centre, anneau de texte
 * qui tourne autour (HÉBERGEMENT HDS · OVHCLOUD · FRANCE) + halo pulsé.
 * Positionnée en absolu dans le coin haut-droite du hero.
 */
function OvhSpinBadge() {
  return (
    <motion.div
      className={s.ovhBadge}
      initial={{ opacity: 0, scale: 0.8, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.8, ease: EASE, delay: 0.4 }}
      aria-hidden="true"
    >
      <span className={s.ovhHalo} />
      <span className={s.ovhDisc}>
        <svg className={s.ovhRing} viewBox="0 0 100 100">
          <defs>
            <path
              id="ovhRingPath"
              d="M50,50 m-37,0 a37,37 0 1,1 74,0 a37,37 0 1,1 -74,0"
            />
          </defs>
          <text className={s.ovhRingText}>
            <textPath href="#ovhRingPath" startOffset="0">
              HÉBERGEMENT HDS ·{" "}
              <tspan className={s.ovhRingStrong}>OVHCLOUD</tspan> · FRANCE ·&nbsp;
            </textPath>
          </text>
        </svg>
        <OvhLogo className={s.ovhCenter} />
      </span>
    </motion.div>
  );
}

/**
 * Hero cinématique de la page Sécurité : porte l'UNIQUE <h1>, photo serveurs
 * en filigrane, texte centré animé à l'entrée + rangée de badges de confiance.
 */
export default function SecurityHero() {
  return (
    <section className={s.hero}>
      <OvhSpinBadge />
      <div className={`wrap ${s.heroInner}`}>
        <motion.div
          className={s.heroText}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: EASE }}
        >
          <div className="kicker">Sécurité &amp; conformité</div>
          <h1 className={s.heroTitle}>
            Vos données de santé,{" "}
            <span className={s.heroAccent}>protégées au plus haut niveau.</span>
          </h1>
          <p className={s.heroLead}>
            Hébergement HDS chez OVHcloud en France, chiffrement de bout en bout
            et conformité RGPD : la confidentialité de vos patients, notre
            priorité absolue.
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
