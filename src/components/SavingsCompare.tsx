"use client";

import Reveal from "@/components/motion/Reveal";
import StaggerGroup from "@/components/motion/StaggerGroup";
import StaggerItem from "@/components/motion/StaggerItem";
import CountUp from "@/components/motion/CountUp";
import {
  Calendar,
  Invoice,
  Calculator,
  Signature,
  Server,
  Check,
  TrendingUp,
  Wallet,
} from "@/components/icons";
import s from "./savings.module.css";

/* Outils séparés que MediCare Pro remplace — total = 285 €/mois. */
const TOOLS = [
  { icon: Calendar, label: "Agenda & prise de RDV en ligne", price: "150 €" },
  { icon: Invoice, label: "Logiciel de facturation", price: "40 €" },
  { icon: Calculator, label: "Expert-comptable / comptabilité", price: "60 €" },
  { icon: Signature, label: "Signature électronique", price: "20 €" },
  { icon: Server, label: "Sauvegarde sécurisée", price: "15 €" },
];

const INCLUDED = [
  "Agenda et prise de RDV inclus",
  "Comptabilité intégrée",
  "Sans aucune option cachée",
];

/**
 * Comparatif économies : carte « outils séparés » (détail à 285 €/mois) vs
 * carte premium MediCare Pro (24,84 €/mois), puis bandeau total animé.
 */
export default function SavingsCompare({
  tone,
}: {
  tone?: "white" | "soft" | "medium";
}) {
  const toneCls =
    tone === "soft"
      ? "tone-soft"
      : tone === "medium"
        ? "tone-medium"
        : "tone-white";

  return (
    <section className={`${s.savings} ${toneCls}`}>
      <div className="wrap">
        <Reveal className="sec-head">
          <div className="kicker">Économies réalisées</div>
          <h2 className="sec-title">Un seul abonnement, pas cinq factures</h2>
          <p className="lead">
            Un podologue dépense en moyenne 285 €/mois en outils séparés.
            MediCare Pro centralise tout à partir de 24,84 €/mois.
          </p>
        </Reveal>

        <div className={s.grid}>
          {/* Carte « outils séparés » — lignes en cascade */}
          <Reveal variant="left" className={s.before}>
            <div className={s.cardLabel}>Sans MediCare Pro</div>
            <StaggerGroup as="ul" className={s.rows}>
              {TOOLS.map(({ icon: Icon, label, price }) => (
                <StaggerItem as="li" className={s.row} key={label} variant="left">
                  <span className={s.rowIco}>
                    <Icon width={20} height={20} />
                  </span>
                  <span className={s.rowLabel}>{label}</span>
                  <span className={s.rowPrice}>{price}</span>
                </StaggerItem>
              ))}
            </StaggerGroup>
            <div className={s.beforeTotal}>
              <span className={s.beforeTotalLabel}>Total mensuel</span>
              <span className={s.beforeTotalPrice}>
                <CountUp to={285} suffix=" €" /> <small>/mois</small>
              </span>
            </div>
          </Reveal>

          {/* Carte premium MediCare Pro */}
          <Reveal variant="right" className={s.after}>
            <span className={s.afterGlow} aria-hidden="true" />
            <div className={s.afterContent}>
              <span className={s.afterBadge}>Tout inclus</span>
              <div className={s.afterName}>MediCare Pro</div>
              <div className={s.afterPrice}>
                <CountUp to={24.84} decimals={2} suffix=" €" /> <small>/mois</small>
              </div>
              <ul className={s.afterPoints}>
                {INCLUDED.map((point) => (
                  <li key={point}>
                    <span className={s.afterTick}>
                      <Check width={13} height={13} />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>

        {/* Bandeau total économisé (compteurs animés) */}
        <StaggerGroup className={s.result}>
          <StaggerItem className={s.resultCard} variant="up">
            <span className={s.resultIco}>
              <TrendingUp width={24} height={24} />
            </span>
            <span className={s.resultValue}>
              <CountUp to={260} prefix="−" suffix=" €" />
            </span>
            <span className={s.resultLabel}>économisés par mois</span>
          </StaggerItem>
          <StaggerItem className={s.resultCard} variant="up">
            <span className={s.resultIco}>
              <Wallet width={24} height={24} />
            </span>
            <span className={s.resultValue}>
              <CountUp to={3120} suffix=" €" />
            </span>
            <span className={s.resultLabel}>économisés par an, en moyenne</span>
          </StaggerItem>
        </StaggerGroup>
      </div>
    </section>
  );
}
