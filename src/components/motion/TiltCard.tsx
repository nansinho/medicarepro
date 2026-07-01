"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import type { PointerEvent, ReactNode } from "react";
import { useIsMobile, useIsReduced } from "./motion";

type TiltCardProps = {
  children: ReactNode;
  className?: string;
  /** Inclinaison max en degrés. */
  max?: number;
};

/**
 * Carte avec léger tilt 3D au pointeur. Désactivé sous 760px,
 * sur écrans tactiles et sous prefers-reduced-motion.
 */
export default function TiltCard({
  children,
  className,
  max = 8,
}: TiltCardProps) {
  const reduced = useIsReduced();
  const mobile = useIsMobile();

  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rx = useSpring(useTransform(py, [0, 1], [max, -max]), {
    stiffness: 200,
    damping: 20,
  });
  const ry = useSpring(useTransform(px, [0, 1], [-max, max]), {
    stiffness: 200,
    damping: 20,
  });

  if (reduced || mobile) {
    return <div className={className}>{children}</div>;
  }

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  };
  const onLeave = () => {
    px.set(0.5);
    py.set(0.5);
  };

  return (
    <motion.div
      className={className}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{
        rotateX: rx,
        rotateY: ry,
        transformStyle: "preserve-3d",
        transformPerspective: 900,
      }}
    >
      {children}
    </motion.div>
  );
}
