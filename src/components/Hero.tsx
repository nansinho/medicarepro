"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, Play, Phone, Headset, MapPin, ArrowRight } from "./icons";
import OvhBadge from "@/components/OvhBadge";
import { useIsMobile } from "@/components/motion/motion";
import { resolveHref } from "@/lib/appLinks";
import { lines } from "@/components/cms/inline";
import type { SectionContentOf } from "@/lib/cms/sections.schema";
import styles from "./Hero.module.css";

/* Icônes de la barre d'infos (clés string du contenu CMS). */
const ICONS = { Phone, Headset, MapPin } as const;

/** Compteur animé "+1 000" avec ease-out, démarré après l'intro. */
function useCountUp(target: number, durationMs: number, delayMs: number) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduce) {
      setValue(target);
      return;
    }
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    let raf = 0;
    let start: number | null = null;
    const tick = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min((ts - start) / durationMs, 1);
      setValue(Math.floor(easeOut(p) * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    const timer = window.setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, delayMs);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [target, durationMs, delayMs]);

  return value;
}

export default function Hero({
  content,
}: {
  content: SectionContentOf<"home_hero">;
}) {
  const avatars = content.proof.avatars;
  const count = useCountUp(content.proof.count ?? 0, 1700, 1250);
  const photoRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  /* 880 : aligné sur la composition mobile/tablette du CSS (texte d'abord,
     photo dans le flux, badge OVH en chip sur la photo). */
  const mobile = useIsMobile(880);

  // Parallax léger sur la photo + le texte du hero. Desktop uniquement :
  // sur mobile/tablette la photo est dans le flux, sous le texte — on
  // n'attache pas le listener de scroll (jank inutile).
  useEffect(() => {
    if (mobile) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduce) return;
    let ticking = false;
    const frame = () => {
      const y = window.scrollY;
      if (photoRef.current)
        photoRef.current.style.translate = `0 ${y * 0.13}px`;
      if (textRef.current && y < 900)
        textRef.current.style.translate = `0 ${y * 0.05}px`;
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(frame);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    const photoEl = photoRef.current;
    const textEl = textRef.current;
    return () => {
      window.removeEventListener("scroll", onScroll);
      // Purge les translations posées en inline (ex. bascule desktop → mobile)
      if (photoEl) photoEl.style.translate = "";
      if (textEl) textEl.style.translate = "";
    };
  }, [mobile]);

  return (
    <>
      <section className={styles.hero}>
        {/* Photo du duo de praticiens (déborde jusqu'au bord droit) */}
        <div className={styles.photoBleed} ref={photoRef}>
          <div className={styles.photo}>
            <Image
              src={content.photos.duo.path}
              alt={content.photos.duo.alt}
              fill
              preload
              sizes="(max-width: 880px) 100vw, 50vw"
              className={styles.duoImg}
            />
          </div>
          {/* Badge OVH version mobile : chip compact épinglé sur la photo.
              Instance séparée (l'instance desktop, hors du bleed, ignore le
              parallaxe et le fondu de la photo), montée seulement ≤760 pour
              éviter un id SVG dupliqué (#ovhRingPath) sur desktop. */}
          {mobile && <OvhBadge className={styles.ovhBadgeMobile} />}
        </div>

        {/* Badge OVH flottant (hébergement HDS) */}
        <OvhBadge className={styles.ovhBadge} />

        <div className={styles.heroInner}>
          <div className={styles.heroText} ref={textRef}>
            <h1>{lines(content.title)}</h1>
            <p className={styles.lead}>{lines(content.lead)}</p>

            <div className={styles.ctaRow}>
              <Link href={content.demoCta.href} className={styles.play}>
                <span className={styles.circ}>
                  <Play className={styles.playIcon} width={18} height={18} />
                </span>
                {content.demoCta.label}
              </Link>

              {/* Prix en texte simple */}
              <Link href={content.priceCta.href} className={styles.priceText}>
                <span className={styles.priceLabel}>
                  {content.priceCta.label}
                </span>
                <span className={styles.priceLine}>
                  <b className={styles.priceAmount}>
                    {content.priceCta.amount}
                  </b>
                  <span className={styles.pricePer}>
                    {content.priceCta.note}
                  </span>
                </span>
              </Link>
            </div>

            {/* Carte preuve sociale, sous le CTA */}
            <div className={styles.proofCard}>
              <div className={styles.avatarsWindow}>
                <div className={styles.avatarsTrack}>
                  {/* liste dupliquée pour une boucle sans couture */}
                  {[...avatars, ...avatars].map((avatar, i) => (
                    <span key={i} className={styles.avatar}>
                      <Image
                        src={avatar.path}
                        alt={avatar.alt}
                        width={44}
                        height={44}
                      />
                    </span>
                  ))}
                </div>
              </div>
              <div className={styles.proofText}>
                <b>
                  {content.proof.count != null ? (
                    <>
                      {content.proof.prefix}
                      {count.toLocaleString("fr-FR")}
                    </>
                  ) : (
                    content.proof.headline
                  )}
                </b>
                <small>{content.proof.label}</small>
              </div>
              <div className={styles.proofCheck}>
                <Check width={15} height={15} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Barre d'infos flottante, à cheval sur le hero et la section suivante */}
      <div className="wrap">
        <div className={styles.infoBar}>
          {content.infoBar.items.map((item) => {
            const Icon = ICONS[item.icon as keyof typeof ICONS];
            return (
              <div className={styles.infoItem} key={item.title}>
                <div className={styles.infoCirc}>
                  <Icon className="ico" />
                </div>
                <div>
                  <h4>{item.title}</h4>
                  <span>{item.value}</span>
                </div>
              </div>
            );
          })}
          <a href={resolveHref(content.infoBar.cta.href)} className="btn">
            {content.infoBar.cta.label} <ArrowRight className="ico ar" />
          </a>
        </div>
      </div>
    </>
  );
}
