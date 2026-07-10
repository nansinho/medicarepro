"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { motion, useInView } from "framer-motion";
import { EASE, useIsReduced } from "@/components/motion/motion";
import Reveal from "@/components/motion/Reveal";
import StaggerGroup from "@/components/motion/StaggerGroup";
import StaggerItem from "@/components/motion/StaggerItem";
import { Quote, Star } from "./icons";
import type { SectionContentOf, Testimonial } from "@/lib/cms/sections.schema";
import s from "./sections2.module.css";

export default function Reviews({
  content,
  people,
}: {
  content: SectionContentOf<"reviews">;
  people: Testimonial[];
}) {
  const [active, setActive] = useState(0);
  const tone = content.tone;
  const toneCls =
    tone === "soft" ? "tone-soft" : tone === "medium" ? "tone-medium" : "tone-white";

  /* Défilement automatique des avis : piloté par la fin de l'animation CSS de
     la barre de progression (onAnimationEnd) → la pause au survol (CSS
     animation-play-state) et le passage à l'avis suivant restent synchrones.
     Actif uniquement quand la section est visible, désactivé en reduced-motion. */
  const gridRef = useRef<HTMLDivElement>(null);
  const reduced = useIsReduced();
  const inView = useInView(gridRef, { amount: 0.35 });
  const autoplay = inView && !reduced;
  const next = () => setActive((a) => (a + 1) % people.length);

  return (
    <section className={`${s.reviews} ${toneCls}`}>
      <div className="wrap">
        <div className="sec-head">
          <h2 className="sec-title">{content.title}</h2>
          <div className={`kicker ${s.kickerUnder}`}>{content.kicker}</div>
        </div>

        {/* Bandeau de preuve sociale : mini-avatars + note moyenne */}
        <Reveal variant="up" className={s.proofBar}>
          <div className={s.proofAvatars}>
            {people.slice(0, 5).map((p) => (
              <span className={s.proofAva} key={p.name}>
                <Image src={p.avatar.path} alt={p.name} fill sizes="46px" />
              </span>
            ))}
          </div>
          <div className={s.proofText}>
            <strong>{content.rating.value}</strong>
            <span className={s.proofStars}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} width={16} height={16} />
              ))}
            </span>
            <small>{content.rating.label}</small>
          </div>
        </Reveal>

        <div className={s.revGrid} ref={gridRef}>
          <StaggerGroup className={s.revPeople}>
            {people.map((p, i) => (
              <StaggerItem key={p.name} variant="left">
                <button
                  className={`${s.revPerson} ${i === active ? s.active : ""}`}
                  onClick={() => setActive(i)}
                  aria-pressed={i === active}
                >
                  <span className={s.ava}>
                    <Image src={p.avatar.path} alt={p.name} fill sizes="64px" />
                  </span>
                  <span className={s.revPersonInfo}>
                    <h4>{p.name}</h4>
                    <small>{p.role}</small>
                  </span>
                  {/* Barre de progression du défilement automatique */}
                  {i === active && autoplay && (
                    <span className={s.revProgress} aria-hidden="true">
                      <span
                        key={active}
                        className={s.revProgressFill}
                        onAnimationEnd={next}
                      />
                    </span>
                  )}
                </button>
              </StaggerItem>
            ))}
          </StaggerGroup>

          <div className={s.revQuote}>
            <div className={s.qm}>
              <Quote width={48} height={48} />
            </div>
            {/* Citation + auteur glissent ensemble à chaque changement */}
            <motion.div
              key={active}
              initial={reduced ? false : { opacity: 0, x: 28 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, ease: EASE }}
            >
              <p>{people[active].quote}</p>
              <div className={s.revQuoteFoot}>
                <div className={s.stars}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} width={22} height={22} />
                  ))}
                </div>
                <span className={s.revAuthor}>
                  {people[active].name} — {people[active].role}
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
