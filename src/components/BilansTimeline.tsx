"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import Reveal from "@/components/motion/Reveal";
import { useIsMobile, useIsReduced } from "@/components/motion/motion";
import p from "./pages.module.css";

type Step = { title: string; text: string };

/**
 * Timeline verticale des étapes : une ligne de progression dégradée se remplit
 * au fil du scroll (scaleY lié à scrollYProgress). Sous prefers-reduced-motion
 * ou en mobile, la ligne est pleine et statique (pas d'animation).
 */
export default function BilansTimeline({ steps }: { steps: Step[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useIsReduced();
  const mobile = useIsMobile();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start center", "end center"],
  });
  const scaleY = useTransform(scrollYProgress, [0, 1], [0, 1]);

  const animated = !reduced && !mobile;

  return (
    <div ref={ref} className={p.timeline}>
      <span className={p.timelineRail} />
      {animated ? (
        <motion.span className={p.timelineProgress} style={{ scaleY }} />
      ) : (
        <span
          className={p.timelineProgress}
          style={{ transform: "scaleY(1)" }}
        />
      )}
      {steps.map((step, i) => (
        <Reveal
          key={step.title}
          variant="left"
          delay={i * 0.08}
          className={p.timelineStep}
        >
          <div className={p.timelineNode}>{i + 1}</div>
          <div className={p.timelineBody}>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}
