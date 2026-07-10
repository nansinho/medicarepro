import Link from "next/link";
import { Check, ArrowRight, Star } from "./icons";
import { registerUrl, resolveHref } from "@/lib/appLinks";
import { emphasize } from "@/components/cms/inline";
import { formatPrice } from "@/components/cms/format";
import type {
  PricingExample,
  PricingPlan,
  SectionContentOf,
} from "@/lib/cms/sections.schema";
import s from "./PricingPage.module.css";

export default function PricingPage({
  as = "h2",
  content,
  plans,
  examples,
}: {
  as?: "h1" | "h2";
  content: SectionContentOf<"pricing">;
  plans: PricingPlan[];
  examples: PricingExample[];
}) {
  const H = as;
  return (
    <section className={s.pricing}>
      <div className="wrap">
        <div className="sec-head">
          <H className="sec-title">
            {emphasize(content.title, (segment, key) => (
              <span key={key} className={s.accent}>
                {segment}
              </span>
            ))}
          </H>
          <p className={s.subtitle}>{content.subtitle}</p>
        </div>

        {/* Cartes tarifaires */}
        <div className={s.cards}>
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`${s.card} ${plan.featured ? s.featured : ""}`}
              data-rv-price
            >
              {plan.badge && (
                <span className={s.badge}>
                  <Star width={13} height={13} /> {plan.badge}
                </span>
              )}
              <h3 className={s.planName}>{plan.name}</h3>
              <p className={s.planSub}>{plan.sub}</p>
              <div className={s.priceRow}>
                <span className={s.priceBig}>{formatPrice(plan.price)}</span>
                <span className={s.priceUnit}>{plan.unit}</span>
              </div>
              <p className={s.priceSecondary}>{plan.secondary}</p>
              <ul className={s.features}>
                {plan.features.map((f) => (
                  <li
                    key={f.label}
                    className={f.highlight ? s.featHighlight : undefined}
                  >
                    <span className={s.tick}>
                      <Check width={13} height={13} />
                    </span>
                    {f.label}
                  </li>
                ))}
              </ul>
              <a
                href={registerUrl(plan.planKey)}
                className={`${s.planBtn} ${
                  plan.featured ? s.planBtnPrimary : s.planBtnSecondary
                }`}
              >
                {plan.cta}
                {plan.featured && <ArrowRight width={18} height={18} />}
              </a>
            </div>
          ))}
        </div>

        {/* Tableau d'exemples */}
        <div className={s.examples}>
          <h3 className={s.examplesTitle}>{content.examplesTitle}</h3>
          <table className={s.table}>
            <thead>
              <tr>
                <th>{content.tableHead.config}</th>
                <th>{content.tableHead.monthly}</th>
                <th className={s.colYear}>{content.tableHead.yearly}</th>
              </tr>
            </thead>
            <tbody>
              {examples.map((row) => (
                <tr key={row.config}>
                  <td>{row.config}</td>
                  <td>{`${formatPrice(row.monthly)} €`}</td>
                  <td className={s.colYear}>{`${formatPrice(row.yearly)} €`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Liens de navigation */}
        <div className={s.navLinks}>
          {content.navLinks.map((link) => (
            <Link key={link.href} href={link.href} className={s.navLink}>
              {link.label}
            </Link>
          ))}
        </div>

        {/* Bande CTA */}
        <div className={s.ctaBand}>
          <h2>{content.ctaBand.title}</h2>
          <p>{content.ctaBand.text}</p>
          <a href={resolveHref(content.ctaBand.cta.href)} className={s.ctaBtn}>
            {content.ctaBand.cta.label} <ArrowRight width={18} height={18} />
          </a>
          <span className={s.ctaNote}>{content.ctaBand.note}</span>
        </div>
      </div>
    </section>
  );
}
