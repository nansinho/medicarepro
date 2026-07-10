"use client";

import { motion } from "framer-motion";
import { EASE } from "@/components/motion/motion";
import { OvhLogo } from "@/components/icons";
import s from "./security.module.css";

/**
 * Pastille OVH flottante réutilisable : disque vitré, logo OVH au centre,
 * anneau de texte qui tourne (HÉBERGEMENT HDS · OVHCLOUD · FRANCE) + halo pulsé.
 * Style dans security.module.css (source unique). Positionnée en absolu par
 * son parent ; `className` permet de surcharger le placement selon le hero.
 */
export default function OvhBadge({ className }: { className?: string }) {
  return (
    <motion.div
      className={`${s.ovhBadge} ${className ?? ""}`}
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
