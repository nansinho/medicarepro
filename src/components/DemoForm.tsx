"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { ArrowRight, Shield } from "./icons";
import s from "./sections3.module.css";

export default function DemoForm({
  as = "h2",
  tone,
}: {
  as?: "h1" | "h2";
  tone?: "white" | "soft" | "medium";
}) {
  const [sent, setSent] = useState(false);
  const H = as;
  const toneCls =
    tone === "soft" ? "tone-soft" : tone === "medium" ? "tone-medium" : "tone-white";

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Pas de back-end pour l'instant : on simule l'envoi.
    setSent(true);
  };

  return (
    <section
      className={`${s.demo} ${toneCls}`}
    >
      <div className="wrap">
        <div className="sec-head">
          <div className="kicker">Démarrer</div>
          <H className="sec-title">Demander une démo</H>
        </div>
        <div className={s.demoGrid}>
          <form className={s.demoForm} onSubmit={onSubmit} data-rv-demoform>
            <div className={s.grid2}>
              <div className={s.field}>
                <label htmlFor="name">Nom</label>
                <input id="name" type="text" placeholder="Votre nom" required />
              </div>
              <div className={s.field}>
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  placeholder="vous@cabinet.fr"
                  required
                />
              </div>
            </div>
            <div className={s.grid2}>
              <div className={s.field}>
                <label htmlFor="tel">Téléphone</label>
                <input id="tel" type="tel" placeholder="06 00 00 00 00" />
              </div>
              <div className={s.field}>
                <label htmlFor="praticiens">Nombre de praticiens</label>
                <select id="praticiens" defaultValue="1">
                  <option value="1">1 (libéral)</option>
                  <option value="2-3">2 à 3</option>
                  <option value="4+">4 et plus</option>
                </select>
              </div>
            </div>
            <div className={s.field}>
              <label htmlFor="message">Message</label>
              <textarea
                id="message"
                rows={4}
                placeholder="Parlez-nous de votre cabinet..."
              />
            </div>
            <label className={s.consent}>
              <input type="checkbox" required /> J&apos;accepte que mes données
              soient traitées conformément à la politique de confidentialité.
            </label>
            <button className="btn" type="submit">
              {sent ? "Message envoyé ✓" : "Envoyer"}
              {!sent && <ArrowRight className="ico ar" />}
            </button>
            <div className={s.hdsNote}>
              <span className={s.ld}>
                <Shield width={22} height={22} />
              </span>
              Vos données sont hébergées en France (HDS), chiffrées et conformes
              RGPD.
            </div>
          </form>
          <div className={s.demoSide} data-rv-demoside>
            <Image
              src="/images/demo-app.jpg"
              alt="Aperçu du tableau de bord MediCare Pro"
              fill
              sizes="(max-width: 760px) 100vw, 45vw"
              style={{ objectFit: "cover" }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
