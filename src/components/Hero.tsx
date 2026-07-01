"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, Play, Phone, Headset, MapPin, ArrowRight } from "./icons";
import { registerUrl } from "@/lib/appLinks";
import styles from "./Hero.module.css";

const AVATARS = [
  "/images/avatars/av1.jpg",
  "/images/avatars/av2.jpg",
  "/images/avatars/av3.jpg",
  "/images/avatars/av4.jpg",
  "/images/avatars/av5.jpg",
  "/images/avatars/av6.jpg",
  "/images/avatars/av7.jpg",
  "/images/avatars/av8.jpg",
];

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

export default function Hero() {
  const count = useCountUp(1000, 1700, 1250);
  const photoRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  // Parallax léger sur la photo + le texte du hero
  useEffect(() => {
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
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <section className={styles.hero}>
        {/* Photos des praticiens (débordent jusqu'au bord droit) */}
        <div className={styles.photoBleed} ref={photoRef}>
          {/* Femme en arrière-plan, décalée à gauche */}
          <div className={`${styles.photo} ${styles.photoBack}`}>
            <Image
              src="/images/hero-femme.png"
              alt="Podologue"
              fill
              priority
              sizes="(max-width: 880px) 100vw, 50vw"
              style={{ objectFit: "contain", objectPosition: "bottom left" }}
            />
          </div>
          {/* Homme au premier plan, à droite */}
          <div className={`${styles.photo} ${styles.photoFront}`}>
            <Image
              src="/images/hero-praticien.png"
              alt="Praticien souriant utilisant MediCare Pro"
              fill
              priority
              sizes="(max-width: 880px) 100vw, 50vw"
              style={{ objectFit: "contain", objectPosition: "bottom right" }}
            />
          </div>
        </div>

        {/* Badge HDS flottant */}
        <div className={styles.shieldBadge}>
          <div>
            <b>HDS</b>
            <br />
            <small>Hébergé en France</small>
          </div>
        </div>

        <div className={styles.heroInner}>
          <div className={styles.heroText} ref={textRef}>
            <h1>
              Tout votre cabinet dans
              <br />
              une seule application
            </h1>
            <p className={styles.lead}>
              Le logiciel complet de gestion pour podologues,
              <br />
              pour vous faire gagner du temps au quotidien.
            </p>

            <div className={styles.ctaRow}>
              <Link href="/contact" className={styles.play}>
                <span className={styles.circ}>
                  <Play className={styles.playIcon} width={18} height={18} />
                </span>
                Voir la démo
              </Link>

              {/* Prix en texte simple */}
              <Link href="/tarifs" className={styles.priceText}>
                <span className={styles.priceLabel}>abonnement</span>
                <span className={styles.priceLine}>
                  <b className={styles.priceAmount}>24,84 €</b>
                  <span className={styles.pricePer}>/mois · tout inclus</span>
                </span>
              </Link>
            </div>

            {/* Carte preuve sociale, sous le CTA */}
            <div className={styles.proofCard}>
              <div className={styles.avatarsWindow}>
                <div className={styles.avatarsTrack}>
                  {/* liste dupliquée pour une boucle sans couture */}
                  {[...AVATARS, ...AVATARS].map((src, i) => (
                    <span key={i} className={styles.avatar}>
                      <Image
                        src={src}
                        alt={`Podologue équipé ${(i % AVATARS.length) + 1}`}
                        width={44}
                        height={44}
                      />
                    </span>
                  ))}
                </div>
              </div>
              <div className={styles.proofText}>
                <b>+{count.toLocaleString("fr-FR")}</b>
                <small>podologues équipés</small>
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
          <div className={styles.infoItem}>
            <div className={styles.infoCirc}>
              <Phone className="ico" />
            </div>
            <div>
              <h4>Téléphone</h4>
              <span>01 23 45 67 89</span>
            </div>
          </div>
          <div className={styles.infoItem}>
            <div className={styles.infoCirc}>
              <Headset className="ico" />
            </div>
            <div>
              <h4>Support</h4>
              <span>7j/7 par chat</span>
            </div>
          </div>
          <div className={styles.infoItem}>
            <div className={styles.infoCirc}>
              <MapPin className="ico" />
            </div>
            <div>
              <h4>Hébergement</h4>
              <span>HDS · France</span>
            </div>
          </div>
          <a href={registerUrl("annual")} className="btn">
            Je m&apos;abonne <ArrowRight className="ico ar" />
          </a>
        </div>
      </div>
    </>
  );
}
