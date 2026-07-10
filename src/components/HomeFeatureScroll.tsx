"use client";

import { useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useMotionValueEvent,
} from "framer-motion";
import AppMockup from "@/components/motion/AppMockup";
import { EASE, useIsMobile, useIsReduced } from "@/components/motion/motion";
import {
  Invoice,
  Signature,
  Calculator,
  Calendar,
  FileText,
  Smartphone,
  ShieldPlus,
  Star,
  Users,
  Monitor,
  Check,
} from "@/components/icons";
import type { FeatureItem, SectionContentOf } from "@/lib/cms/sections.schema";
import s from "./homeFeatureScroll.module.css";

const ICONS = {
  Invoice,
  Signature,
  Calculator,
  Calendar,
  FileText,
  Smartphone,
  ShieldPlus,
  Star,
  Users,
  Monitor,
} as const;

type Head = Pick<SectionContentOf<"feature_scroll">, "kicker" | "title">;

/* Teinte de fond FRANCHE propre à chaque feature (une par feature) : couleurs
   vives et contrastées, texte blanc par-dessus (cf. .section dans le CSS).
   Le fond bascule par palier quand la feature change (pas d'interpolation). */
const BG_COLORS = [
  "#2b6fd6", // Facturation — bleu MediCare
  "#0ea5a5", // Signature — turquoise
  "#6d5cf5", // Comptabilité — indigo/violet
  "#e6532f", // Agenda — corail
  "#8b3fd6", // Bilans — violet
  "#0f7fd6", // PWA — cyan profond
];

/**
 * Défilement cinématique « sticky » des fonctionnalités : la section reste
 * figée à l'écran pendant qu'on scrolle, et la fonctionnalité active se
 * remplace (fondu + translation), pilotée par la progression du scroll.
 * On met en scène un sous-ensemble marquant (`content.limit`) de la
 * collection feature_items.
 *
 * Repli accessible : sous prefers-reduced-motion ou en mobile, on empile
 * simplement les fonctionnalités (pas de sticky, pas d'animation liée au scroll).
 */
export default function HomeFeatureScroll({
  content,
  items,
}: {
  content: SectionContentOf<"feature_scroll">;
  items: FeatureItem[];
}) {
  const reduced = useIsReduced();
  const mobile = useIsMobile();
  const features = items.slice(0, content.limit);

  if (reduced || mobile) return <FeatureFallback head={content} features={features} />;
  return <FeatureCinematic head={content} features={features} />;
}

/* ---------- Version cinématique (desktop, motion activé) ---------- */
function FeatureCinematic({
  head,
  features,
}: {
  head: Head;
  features: FeatureItem[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  // Barre de progression verticale (0 → 1 sur toute la hauteur pinnée).
  const progressScaleY = useTransform(scrollYProgress, [0, 1], [0, 1]);

  // La progression du scroll découpe la piste en autant de segments que de features.
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const next = Math.min(
      features.length - 1,
      Math.floor(v * features.length),
    );
    setIndex((prev) => (prev === next ? prev : next));
  });

  const feature = features[index];
  const Icon = ICONS[feature.icon as keyof typeof ICONS];

  return (
    <section
      ref={ref}
      className={s.section}
      style={{ height: `${features.length * 100}vh` }}
      aria-label="Fonctionnalités clés"
    >
      {/* Fond franc par palier : la couleur reste stable pendant toute la
          feature, puis bascule (fondu court) pile quand la feature change —
          synchronisé avec le texte/mockup, pas d'interpolation « baveuse ». */}
      <motion.div
        className={s.sticky}
        animate={{ backgroundColor: BG_COLORS[index] }}
        transition={{ duration: 0.35, ease: EASE }}
      >
        <div className={`wrap ${s.inner}`}>
          <div className={s.head}>
            <div className={s.kicker}>{head.kicker}</div>
            <h2 className={s.title}>{head.title}</h2>
          </div>

          <div className={s.stage}>
            {/* Colonne texte : la feature active en fondu/translation */}
            <div className={s.textCol}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={feature.title}
                  className={s.textInner}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -24 }}
                  transition={{ duration: 0.5, ease: EASE }}
                >
                  <div className={s.iconRow}>
                    <span className={s.icon}>
                      <Icon width={26} height={26} />
                    </span>
                    <span className={s.featKicker}>{feature.kicker}</span>
                  </div>
                  <h3 className={s.featTitle}>{feature.title}</h3>
                  <p className={s.featText}>{feature.text}</p>
                  <ul className={s.points}>
                    {feature.points.map((pt) => (
                      <li key={pt}>
                        <span className={s.tick}>
                          <Check width={13} height={13} />
                        </span>
                        {pt}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              </AnimatePresence>

              {/* Pastilles de progression (feature active) */}
              <div className={s.dots}>
                {features.map((f, i) => (
                  <span
                    key={f.title}
                    className={`${s.dot} ${i === index ? s.dotOn : ""}`}
                    aria-hidden
                  />
                ))}
              </div>
            </div>

            {/* Colonne visuelle : le mockup de la feature active */}
            <div className={s.visualCol}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={feature.mockup}
                  className={s.visual}
                  initial={{ opacity: 0, scale: 0.94, y: 30 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -30 }}
                  transition={{ duration: 0.55, ease: EASE }}
                >
                  <AppMockup kind={feature.mockup} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Barre de progression du scroll */}
          <div className={s.rail}>
            <motion.span
              className={s.railFill}
              style={{ scaleY: progressScaleY }}
            />
          </div>
        </div>
      </motion.div>
    </section>
  );
}

/* ---------- Repli accessible (mobile / reduced-motion) ---------- */
function FeatureFallback({
  head,
  features,
}: {
  head: Head;
  features: FeatureItem[];
}) {
  return (
    <section className={`${s.fallback} tone-white`} aria-label="Fonctionnalités clés">
      <div className={`wrap ${s.inner}`}>
        <div className={s.head}>
          <div className={s.kicker}>{head.kicker}</div>
          <h2 className={s.title}>{head.title}</h2>
        </div>
        <div className={s.fallbackList}>
          {features.map((feature) => {
            const Icon = ICONS[feature.icon as keyof typeof ICONS];
            return (
              <article key={feature.title} className={s.fallbackCard}>
                <div className={s.iconRow}>
                  <span className={s.icon}>
                    <Icon width={24} height={24} />
                  </span>
                  <span className={s.featKicker}>{feature.kicker}</span>
                </div>
                <h3 className={s.featTitle}>{feature.title}</h3>
                <p className={s.featText}>{feature.text}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
