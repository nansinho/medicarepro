"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { EASE } from "@/components/motion/motion";
import Reveal from "@/components/motion/Reveal";
import StaggerGroup from "@/components/motion/StaggerGroup";
import StaggerItem from "@/components/motion/StaggerItem";
import { Quote, Star } from "./icons";
import s from "./sections2.module.css";

const PEOPLE = [
  {
    name: "Camille Besson",
    role: "Podologue · Lyon",
    avatar: "/images/avatars/av1.jpg",
    quote:
      "J'ai enfin un seul outil pour tout : dossiers, bilans, factures. La facturation automatisée me fait gagner un temps fou, et savoir que tout est hébergé en HDS me rassure vraiment.",
  },
  {
    name: "Antoine Rivière",
    role: "Pédicure-podologue · Bordeaux",
    avatar: "/images/avatars/av2.jpg",
    quote:
      "La signature électronique et la comptabilité intégrée ont supprimé mes allers-retours entre logiciels. Tout est centralisé, c'est limpide.",
  },
  {
    name: "Sarah Lemoine",
    role: "Podologue · Lille",
    avatar: "/images/avatars/av3.jpg",
    quote:
      "Les bilans avec scores calculés automatiquement sont un vrai plus pour le suivi. Et le prix unique sans option cachée, ça change tout.",
  },
  {
    name: "Julien Moreau",
    role: "Podologue · Nantes",
    avatar: "/images/avatars/av4.jpg",
    quote:
      "Je suis passé de quatre logiciels à un seul. Mes soirées de paperasse ont tout simplement disparu.",
  },
  {
    name: "Léa Fontaine",
    role: "Pédicure-podologue · Toulouse",
    avatar: "/images/avatars/av5.jpg",
    quote:
      "L'agenda en ligne a divisé mes appels par deux : les patients réservent seuls, je me concentre sur les soins.",
  },
  {
    name: "Marc Dubois",
    role: "Podologue · Strasbourg",
    avatar: "/images/avatars/av6.jpg",
    quote:
      "Hébergement HDS en France et prix unique transparent : exactement ce que je cherchais pour mon cabinet.",
  },
];

export default function Reviews({
  tone,
}: {
  tone?: "white" | "soft" | "medium";
}) {
  const [active, setActive] = useState(0);
  const toneCls =
    tone === "soft" ? "tone-soft" : tone === "medium" ? "tone-medium" : "tone-white";

  return (
    <section className={`${s.reviews} ${toneCls}`}>
      <div className="wrap">
        <div className="sec-head">
          <h2 className="sec-title">Ils nous font confiance</h2>
          <div className={`kicker ${s.kickerUnder}`}>Avis de podologues</div>
        </div>

        {/* Bandeau de preuve sociale : mini-avatars + note moyenne */}
        <Reveal variant="up" className={s.proofBar}>
          <div className={s.proofAvatars}>
            {PEOPLE.slice(0, 5).map((p) => (
              <span className={s.proofAva} key={p.name}>
                <Image src={p.avatar} alt={p.name} fill sizes="46px" />
              </span>
            ))}
          </div>
          <div className={s.proofText}>
            <strong>4,9/5</strong>
            <span className={s.proofStars}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} width={16} height={16} />
              ))}
            </span>
            <small>note moyenne · podologues abonnés</small>
          </div>
        </Reveal>

        <div className={s.revGrid}>
          <StaggerGroup className={s.revPeople}>
            {PEOPLE.map((p, i) => (
              <StaggerItem key={p.name} variant="left">
                <button
                  className={`${s.revPerson} ${i === active ? s.active : ""}`}
                  onClick={() => setActive(i)}
                  aria-pressed={i === active}
                >
                  <span className={s.ava}>
                    <Image src={p.avatar} alt={p.name} fill sizes="64px" />
                  </span>
                  <span className={s.revPersonInfo}>
                    <h4>{p.name}</h4>
                    <small>{p.role}</small>
                  </span>
                </button>
              </StaggerItem>
            ))}
          </StaggerGroup>

          <div className={s.revQuote}>
            <div className={s.qm}>
              <Quote width={48} height={48} />
            </div>
            <motion.p
              key={active}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              {PEOPLE[active].quote}
            </motion.p>
            <div className={s.revQuoteFoot}>
              <div className={s.stars}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} width={22} height={22} />
                ))}
              </div>
              <span className={s.revAuthor}>
                {PEOPLE[active].name} — {PEOPLE[active].role}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
