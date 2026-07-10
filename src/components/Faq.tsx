"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronUp } from "./icons";
import type { FaqItem, SectionContentOf } from "@/lib/cms/sections.schema";
import s from "./sections3.module.css";

export default function Faq({
  content,
  items,
}: {
  content: SectionContentOf<"faq">;
  items: FaqItem[];
}) {
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
          <div className="kicker">{content.kicker}</div>
          <h2 className="sec-title">{content.title}</h2>
        </div>
        <div
          ref={listRef}
          className={`${s.faqList} ${revealed ? s.revealed : ""}`}
        >
          {items.map((item, i) => {
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
