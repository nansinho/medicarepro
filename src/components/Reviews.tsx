"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useInView } from "framer-motion";
import { EASE, useIsReduced } from "@/components/motion/motion";
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

  /* Carrousel d'avis : une card active mise en avant, les autres en aperçu
     autour. Défilement automatique piloté par la fin de l'animation CSS de la
     barre de progression (onAnimationEnd) → la pause au survol (CSS
     animation-play-state) et le passage à l'avis suivant restent synchrones.
     Actif uniquement quand la section est visible, désactivé en reduced-motion. */
  const railRef = useRef<HTMLDivElement>(null);
  const reduced = useIsReduced();
  const inView = useInView(railRef, { amount: 0.35 });
  const autoplay = inView && !reduced && people.length > 1;
  const go = (i: number) => setActive(((i % people.length) + people.length) % people.length);
  const next = () => go(active + 1);

  return (
    <section className={`${s.reviews} ${toneCls}`}>
      <div className="wrap">
        <div className="sec-head">
          <h2 className="sec-title">{content.title}</h2>
          <div className={`kicker ${s.kickerUnder}`}>{content.kicker}</div>
        </div>

        {/* Carrousel de cards : chaque card porte l'avatar + le témoignage.
           À terme, le bandeau logos partenaires (école de Marseille, Xfeet)
           viendra au-dessus. */}
        <div className={s.revCarousel} ref={railRef}>
          <button
            type="button"
            className={`${s.revNav} ${s.revNavPrev}`}
            onClick={() => go(active - 1)}
            aria-label="Avis précédent"
          >
            <span aria-hidden="true">‹</span>
          </button>

          <div className={s.revStage}>
            <AnimatePresence initial={false} mode="popLayout">
              <motion.article
                key={active}
                className={s.revCard}
                initial={reduced ? false : { opacity: 0, x: 40, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, x: -40, scale: 0.96 }}
                transition={{ duration: 0.5, ease: EASE }}
              >
                <div className={s.revCardHead}>
                  <span className={s.revCardAva}>
                    <Image
                      src={people[active].avatar.path}
                      alt={people[active].name}
                      fill
                      sizes="72px"
                    />
                  </span>
                  <span className={s.revCardWho}>
                    <h4>{people[active].name}</h4>
                    <small>{people[active].role}</small>
                  </span>
                  <span className={s.revCardQuote} aria-hidden="true">
                    <Quote width={40} height={40} />
                  </span>
                </div>

                <p className={s.revCardText}>{people[active].quote}</p>

                <div className={s.revCardStars} aria-label="Note : 5 sur 5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} width={20} height={20} />
                  ))}
                </div>

                {/* Barre de progression du défilement automatique */}
                {autoplay && (
                  <span className={s.revCardProgress} aria-hidden="true">
                    <span
                      key={active}
                      className={s.revCardProgressFill}
                      onAnimationEnd={next}
                    />
                  </span>
                )}
              </motion.article>
            </AnimatePresence>
          </div>

          <button
            type="button"
            className={`${s.revNav} ${s.revNavNext}`}
            onClick={() => go(active + 1)}
            aria-label="Avis suivant"
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>

        {/* Points de navigation */}
        <div className={s.revDots} role="tablist" aria-label="Choisir un avis">
          {people.map((p, i) => (
            <button
              key={p.name}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`Avis de ${p.name}`}
              className={`${s.revDot} ${i === active ? s.revDotOn : ""}`}
              onClick={() => go(i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
