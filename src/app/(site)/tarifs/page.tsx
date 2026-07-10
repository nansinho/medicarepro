import type { Metadata } from "next";
import { PageHero } from "@/components/Sections";
import PricingPage from "@/components/PricingPage";
import Faq from "@/components/Faq";
import { ArrowRight } from "@/components/icons";
import { emphasize } from "@/components/cms/inline";
import { formatPrice } from "@/components/cms/format";
import { getPageSections, pick } from "@/lib/cms/pages";
import {
  getFaqItems,
  getPricingExamples,
  getPricingPlans,
} from "@/lib/cms/collections";
import { pageMetadata } from "@/lib/cms/seo";
import p from "@/components/pages.module.css";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/tarifs");
}

export default async function TarifsPage() {
  const [sections, plans, examples, faqItems] = await Promise.all([
    getPageSections("/tarifs"),
    getPricingPlans(),
    getPricingExamples(),
    getFaqItems(),
  ]);
  const hero = pick(sections, "hero", "page_hero");
  const pricing = pick(sections, "pricing", "pricing");
  const savings = pick(sections, "savings", "savings_compare");
  const faq = pick(sections, "faq", "faq");

  /* Schema.org FAQPage : expose la FAQ aux résultats enrichis de Google. */
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <PageHero
        kicker={hero.kicker ?? ""}
        title={hero.title}
        lead={hero.lead}
        image={hero.image?.path}
      />
      <PricingPage content={pricing} plans={plans} examples={examples} />

      {/* Bloc Économies — angle ROI canonique sur cette page */}
      <section className={p.savings}>
        <div className="wrap">
          <div className="sec-head">
            <div className="kicker">{savings.kicker}</div>
            <h2 className="sec-title">{savings.title}</h2>
            <p className="lead">{savings.lead}</p>
          </div>

          {/* Carte comparative : 285 € → 24,84 € */}
          <div className={p.savingsCompare} data-rv-savecompare>
            <div className={`${p.savingsSide} ${p.savingsBefore}`}>
              <div className={p.savingsSideLabel}>{savings.before.label}</div>
              <div className={p.savingsSidePrice}>
                {`${formatPrice(savings.before.price)} €`}{" "}
                <small>{savings.before.priceNote}</small>
              </div>
            </div>
            <div className={p.savingsArrow}>
              <ArrowRight width={22} height={22} />
            </div>
            <div className={`${p.savingsSide} ${p.savingsAfter}`}>
              <div className={p.savingsSideLabel}>{savings.after.label}</div>
              <div className={p.savingsSidePrice}>
                {`${formatPrice(savings.after.price)} €`}{" "}
                <small>{savings.after.priceNote}</small>
              </div>
            </div>
          </div>

          {savings.result && (
            <p className={p.savingsResult} data-rv-saveresult>
              {emphasize(savings.result, (segment, key) => (
                <b key={key}>{segment}</b>
              ))}
            </p>
          )}

          <div className={p.savingsHighlights}>
            {savings.stats.map((stat) => (
              <div className={p.savingsStat} key={stat.label} data-rv-savestat>
                <b>{stat.value}</b>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Faq content={faq} items={faqItems} />
    </>
  );
}
