import type { Metadata } from "next";
import { PageHero } from "@/components/Sections";
import PricingPage from "@/components/PricingPage";
import Faq from "@/components/Faq";
import { ArrowRight } from "@/components/icons";
import p from "@/components/pages.module.css";

export const metadata: Metadata = {
  title: "Tarifs",
  description:
    "Une offre unique tout inclus : sans engagement à 29,88 € TTC/mois ou offre 12 mois à 24,84 € TTC/mois (−17 %). Service secrétariat gratuit, conforme HDS et RGPD.",
  alternates: { canonical: "/tarifs" },
};

const STATS = [
  { value: "−260 €", label: "par mois face aux outils séparés" },
  { value: "−17 %", label: "sur l'offre 12 mois (60,48 €/an)" },
  { value: "0 €", label: "d'option cachée — tout est inclus" },
];

export default function TarifsPage() {
  return (
    <>
      <PageHero
        kicker="Tarifs"
        title="Un prix unique, tout compris, sans surprise"
        lead="Pas d'option payante, pas de module en supplément. Toutes les fonctionnalités incluses, à partir de 24,84 €/mois."
      />
      <PricingPage />

      {/* Bloc Économies — angle ROI canonique sur cette page */}
      <section className={p.savings}>
        <div className="wrap">
          <div className="sec-head">
            <div className="kicker">Économies réalisées</div>
            <h2 className="sec-title">
              Combien coûte un logiciel de podologie ?
            </h2>
            <p className="lead">
              Un podologue dépense en moyenne 285 €/mois en outils séparés.
              MediCare Pro centralise tout à partir de 24,84 €/mois.
            </p>
          </div>

          {/* Carte comparative : 285 € → 24,84 € */}
          <div className={p.savingsCompare} data-rv-savecompare>
            <div className={`${p.savingsSide} ${p.savingsBefore}`}>
              <div className={p.savingsSideLabel}>Outils séparés</div>
              <div className={p.savingsSidePrice}>
                285 € <small>/mois</small>
              </div>
            </div>
            <div className={p.savingsArrow}>
              <ArrowRight width={22} height={22} />
            </div>
            <div className={`${p.savingsSide} ${p.savingsAfter}`}>
              <div className={p.savingsSideLabel}>MediCare Pro, tout inclus</div>
              <div className={p.savingsSidePrice}>
                24,84 € <small>/mois</small>
              </div>
            </div>
          </div>

          <p className={p.savingsResult} data-rv-saveresult>
            Soit <b>+3 000 € économisés par an</b>, en moyenne.
          </p>

          <div className={p.savingsHighlights}>
            {STATS.map((stat) => (
              <div className={p.savingsStat} key={stat.label} data-rv-savestat>
                <b>{stat.value}</b>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Faq />
    </>
  );
}
