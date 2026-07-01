import Link from "next/link";
import { Check, ArrowRight, Star } from "./icons";
import { registerUrl } from "@/lib/appLinks";
import s from "./PricingPage.module.css";

type Plan = {
  name: string;
  sub: string;
  price: string;
  unit: string;
  secondary: string;
  featured?: boolean;
  badge?: string;
  planKey: "monthly" | "annual";
  features: { label: string; highlight?: boolean }[];
  cta: string;
};

const PLANS: Plan[] = [
  {
    name: "Sans engagement",
    sub: "Liberté totale",
    price: "29,88",
    unit: "TTC/mois",
    secondary: "soit 24,90 € HT/mois",
    planKey: "monthly",
    features: [
      { label: "Toutes les fonctionnalités incluses" },
      { label: "1 praticien titulaire inclus" },
      { label: "Résiliable à tout moment (préavis 15 jours)" },
      { label: "Service secrétariat inclus (gratuit)" },
      { label: "+15,00 € TTC/mois par collaborateur" },
      { label: "Mises à jour incluses" },
    ],
    cta: "Choisir cette offre",
  },
  {
    name: "Offre 12 mois",
    sub: "Engagement 12 mois ferme",
    price: "24,84",
    unit: "TTC/mois",
    secondary: "soit 20,70 € HT/mois — 298,08 € TTC/an",
    featured: true,
    badge: "−17 % recommandé",
    planKey: "annual",
    features: [
      { label: "Toutes les fonctionnalités incluses" },
      { label: "1 praticien titulaire inclus" },
      { label: "Économisez 60,48 €/an", highlight: true },
      { label: "Service secrétariat inclus (gratuit)" },
      { label: "+15,00 € TTC/mois par collaborateur" },
      { label: "Mises à jour incluses" },
    ],
    cta: "Choisir cette offre",
  },
];

const EXAMPLES = [
  { config: "1 praticien", monthly: "29,88 €", yearly: "24,84 €" },
  { config: "1 prat. + 1 collaborateur", monthly: "44,88 €", yearly: "39,84 €" },
  { config: "1 prat. + 2 collaborateurs", monthly: "59,88 €", yearly: "54,84 €" },
];

export default function PricingPage({ as = "h2" }: { as?: "h1" | "h2" } = {}) {
  const H = as;
  return (
    <section className={s.pricing}>
      <div className="wrap">
        <div className="sec-head">
          <H className="sec-title">
            Une offre unique, <span className={s.accent}>tout inclus</span>
          </H>
          <p className={s.subtitle}>
            Pas d&apos;options payantes, pas de modules en supplément. Toutes
            les fonctionnalités sont incluses.
          </p>
        </div>

        {/* Cartes tarifaires */}
        <div className={s.cards}>
          {PLANS.map((plan) => (
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
                <span className={s.priceBig}>{plan.price}</span>
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
          <h3 className={s.examplesTitle}>Exemples de tarification</h3>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Configuration</th>
                <th>Mensuel</th>
                <th className={s.colYear}>Annuel</th>
              </tr>
            </thead>
            <tbody>
              {EXAMPLES.map((row) => (
                <tr key={row.config}>
                  <td>{row.config}</td>
                  <td>{row.monthly}</td>
                  <td className={s.colYear}>{row.yearly}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Liens de navigation */}
        <div className={s.navLinks}>
          <Link href="/securite" className={s.navLink}>
            ← Sécurité
          </Link>
          <Link href="/avantages" className={s.navLink}>
            Les avantages →
          </Link>
          <Link href="/fonctionnalites" className={s.navLink}>
            Toutes les fonctionnalités →
          </Link>
        </div>

        {/* Bande CTA */}
        <div className={s.ctaBand}>
          <h2>Arrêtez de payer 285 €/mois pour 24,84 €</h2>
          <p>Tout inclus. Économisez plus de 3 000 € par an.</p>
          <a href={registerUrl("annual")} className={s.ctaBtn}>
            Je m&apos;abonne <ArrowRight width={18} height={18} />
          </a>
          <span className={s.ctaNote}>
            Offre 12 mois · 24,84 €/mois TTC
          </span>
        </div>
      </div>
    </section>
  );
}
