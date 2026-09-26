import type { Metadata } from "next";
import { Head, Section } from "@/components/site/Kit";
import PageHead from "@/components/site/PageHead";
import { CtaBlock, FaqBlock, FaqJsonLd, LinksRow } from "@/components/site/Blocks";
import { ExamplesTable, PlansBlock, SavingsBlock } from "@/components/site/PricingBlocks";
import { getPageSections, pick } from "@/lib/cms/pages";
import { getFaqItems, getPricingExamples, getPricingPlans } from "@/lib/cms/collections";
import { pageMetadata } from "@/lib/cms/seo";

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

  return (
    <>
      {/* Schema.org FAQPage : la FAQ canonique du site vit sur cette page. */}
      <FaqJsonLd items={faqItems} />

      <PageHead
        content={hero}
        crumbs={[
          { label: "Accueil", href: "/" },
          { label: "Tarifs", href: "/tarifs" },
        ]}
        textOnly
      />

      <Section tint="blue" edge={1}>
        <Head title={pricing.title} lead={pricing.subtitle} centered />
        <PlansBlock plans={plans} />
        <ExamplesTable title={pricing.examplesTitle} head={pricing.tableHead} rows={examples} />
      </Section>

      <Section center>
        <Head eyebrow={savings.kicker} title={savings.title} lead={savings.lead} centered />
        <SavingsBlock content={savings} />
      </Section>

      <Section tint="amber" edge={5} id="faq">
        <FaqBlock kicker={faq.kicker} title={faq.title} items={faqItems} />
      </Section>

      <Section tight>
        <CtaBlock
          kicker={pricing.ctaBand.note}
          title={pricing.ctaBand.title}
          lead={pricing.ctaBand.text}
          primary={pricing.ctaBand.cta}
          secondary={{ label: "Demander une démo", href: "/contact" }}
        />
        <div style={{ marginTop: 40 }}>
          <LinksRow
            links={pricing.navLinks.map((l) => ({
              ...l,
              label: l.label.replace(/^←\s*|\s*→$/g, ""),
            }))}
          />
        </div>
      </Section>
    </>
  );
}
