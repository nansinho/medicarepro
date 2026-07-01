"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronUp } from "./icons";
import s from "./sections3.module.css";

const FAQ_ITEMS = [
  {
    q: "Mes données patients sont-elles sécurisées ?",
    a: "Oui. Hébergement certifié HDS en France, chiffrement complet, authentification forte et sauvegardes quotidiennes.",
  },
  {
    q: "Y a-t-il un engagement ?",
    a: "L'offre Sans Engagement est résiliable à tout moment (préavis 15 jours). L'offre 12 mois ferme vous fait économiser environ 17 % (soit 60,48 €/an).",
  },
  {
    q: "Puis-je migrer depuis mon ancien logiciel ?",
    a: "Oui, nous vous accompagnons dans la reprise et l'import de vos données existantes.",
  },
  {
    q: "Le logiciel fonctionne-t-il sur mobile ?",
    a: "Oui, via une application PWA installable sur mobile et tablette, accessible partout.",
  },
  {
    q: "Y a-t-il des options payantes cachées ?",
    a: "Non, tout est inclus. Seul un collaborateur supplémentaire (praticien) est facturé +15,00 € TTC/mois. Le service secrétariat (planning + admin) est gratuit.",
  },
];

export default function Faq() {
  const [open, setOpen] = useState(0);
  // Apparition au scroll gérée en React (et non par ScrollEffects) pour que
  // les re-renders au clic ne réécrasent pas la classe de révélation.
  const [revealed, setRevealed] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRevealed(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRevealed(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section className={s.faq}>
      <div className="wrap">
        <div className="sec-head">
          <div className="kicker">Questions fréquentes</div>
          <h2 className="sec-title">Vous vous demandez…</h2>
        </div>
        <div
          ref={listRef}
          className={`${s.faqList} ${revealed ? s.revealed : ""}`}
        >
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div
                key={item.q}
                className={`${s.faqItem} ${isOpen ? s.open : ""}`}
                style={{ transitionDelay: `${(i % 6) * 75}ms` }}
              >
                <button
                  className={s.faqQ}
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  aria-expanded={isOpen}
                >
                  {item.q}
                  <span className={s.toggle}>
                    <ChevronUp width={16} height={16} />
                  </span>
                </button>
                <div className={s.faqA}>
                  <p>{item.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
