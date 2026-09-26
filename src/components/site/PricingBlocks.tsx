import type { CSSProperties } from "react";
import { formatPrice } from "@/components/cms/format";
import { registerUrl } from "@/lib/appLinks";
import type { PricingExample, PricingPlan, SectionContentOf } from "@/lib/cms/sections.schema";
import { Btn, StarList, fr, rich } from "./Kit";
import { Icon } from "./icon";
import { StatsBlock } from "./Blocks";
import b from "./blocks.module.css";

/* ============================================================
   Tarifs : formules (collection pricing_plans), tableau
   d'exemples (pricing_examples), comparatif d'économies.
   Les boutons mènent au tunnel d'inscription de la vitrine,
   formule présélectionnée (registerUrl).
   ============================================================ */

export function PlansBlock({ plans }: { plans: PricingPlan[] }) {
  /* La formule mise en avant passe en premier. */
  const ordered = [...plans].sort((a, c) => Number(Boolean(c.featured)) - Number(Boolean(a.featured)));
  return (
    <div className={b.plans}>
      {ordered.map((plan) => (
        <div key={plan.planKey} className={`${b.plan} ${plan.featured ? b.hi : ""}`} data-rv-kit="">
          {plan.badge && <span className={b.planTag}>{plan.badge}</span>}
          <h3>{plan.name}</h3>
          <p className={b.planSub}>{plan.sub}</p>
          <div className={b.planPrice}>
            <b>{formatPrice(plan.price)}&nbsp;€</b>
            <span>{plan.unit}</span>
          </div>
          <p className={b.planSecondary}>{fr(plan.secondary)}</p>
          <StarList
            items={plan.features.map((f) => (f.highlight ? `**${f.label}**` : f.label))}
            color={plan.featured ? "var(--brand-amber)" : "var(--brand-blue)"}
          />
          <Btn
            href={registerUrl(plan.planKey)}
            variant={plan.featured ? "amber" : "primary"}
            size="lg"
            className={b.planBtn}
          >
            {plan.cta}
          </Btn>
        </div>
      ))}
    </div>
  );
}

export function ExamplesTable({
  title,
  head,
  rows,
}: {
  title: string;
  head: SectionContentOf<"pricing">["tableHead"];
  rows: PricingExample[];
}) {
  if (rows.length === 0) return null;
  return (
    <div className={b.examples} data-rv-kit="">
      <h3>{title}</h3>
      <div className={b.tableWrap}>
        <table className={b.table}>
          <thead>
            <tr>
              <th scope="col">{head.config}</th>
              <th scope="col">{head.monthly}</th>
              <th scope="col">{head.yearly}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.config}>
                <td>{row.config}</td>
                <td className={b.num}>{formatPrice(row.monthly)}&nbsp;€</td>
                <td className={b.num}>{formatPrice(row.yearly)}&nbsp;€</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Deux barres à la même échelle : outils séparés contre MediCare Pro. */
export function SavingsBlock({ content }: { content: SectionContentOf<"savings_compare"> }) {
  const { before, after } = content;
  if (before.tools && before.tools.length > 0) return <SavingsDetail content={content} />;
  const ratio = before.price > 0 ? Math.max(4, (after.price / before.price) * 100) : 100;
  return (
    <>
      <div className={b.cmp} data-rv-kit="">
        <div className={b.cmpRow}>
          <span>{before.label}</span>
          <div className={`${b.bar} ${b.barA}`}>
            <i style={{ width: "100%" }}>
              {formatPrice(before.price)}&nbsp;€{before.priceNote ?? ""}
            </i>
          </div>
        </div>
        <div className={b.cmpRow}>
          <span>{after.label}</span>
          <div className={`${b.bar} ${b.barB}`}>
            <i style={{ width: `${ratio}%` } as CSSProperties}>
              <em>
                {formatPrice(after.price)}&nbsp;€{after.priceNote ?? ""}
              </em>
            </i>
          </div>
        </div>
      </div>
      {content.result && <p className={b.cmpResult}>{rich(content.result)}</p>}
      {content.stats.length > 0 &&
        (content.stats.every((s) => s.value) ? (
          <div className={b.cmpStats}>
            {content.stats.map((s) => (
              <div key={s.label} className={b.statCard} data-rv-kit="">
                <b>{s.value}</b>
                <span>{fr(s.label)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ marginTop: 40 }}>
            <StatsBlock
              stats={content.stats.map((s) => ({
                icon: s.icon ?? "CheckCircle",
                to: s.to ?? 0,
                prefix: s.prefix,
                suffix: s.suffix,
                decimals: s.decimals,
                label: s.label,
              }))}
            />
          </div>
        ))}
    </>
  );
}

/** Variante détaillée : les outils remplacés, un par un, face à MediCare Pro. */
function SavingsDetail({ content }: { content: SectionContentOf<"savings_compare"> }) {
  const { before, after } = content;
  const cols = Math.min(content.stats.length, 3);
  return (
    <>
      <div className={b.versus}>
        <div className={b.vsCard} data-rv-kit="">
          <h3>{before.label}</h3>
          {(before.tools ?? []).map((tool) => (
            <div key={tool.label} className={b.vsRow}>
              <Icon name={tool.icon} />
              <span>{tool.label}</span>
              <b>{fr(tool.price)}</b>
            </div>
          ))}
          <div className={b.vsTotal}>
            <span>{before.totalLabel ?? "Total"}</span>
            <b>
              {formatPrice(before.price)}&nbsp;€{before.priceNote ?? ""}
            </b>
          </div>
        </div>
        <div className={`${b.vsCard} ${b.good}`} data-rv-kit="">
          {after.badge && <span className={b.vsBadge}>{after.badge}</span>}
          <h3>{after.label}</h3>
          <div className={b.vsPrice}>
            <b>{formatPrice(after.price)}&nbsp;€</b>
            <span>{after.priceNote ?? ""}</span>
          </div>
          {after.points && <StarList items={after.points} color="var(--brand-teal)" />}
          <div style={{ marginTop: 26 }}>
            <Btn href="/tarifs" variant="primary" size="lg">
              Voir les tarifs
            </Btn>
          </div>
        </div>
      </div>
      {content.result && <p className={b.cmpResult}>{rich(content.result)}</p>}
      {cols > 0 && (
        <div className={b.cmpStats} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {content.stats.map((s) => (
            <div key={s.label} className={b.statCard} data-rv-kit="">
              <b>
                {s.value ??
                  `${s.prefix ?? ""}${new Intl.NumberFormat("fr-FR").format(s.to ?? 0)}${s.suffix ?? ""}`}
              </b>
              <span>{fr(s.label)}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
