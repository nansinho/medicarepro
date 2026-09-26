import type { Metadata } from "next";
import { Head, Section, type Tint } from "@/components/site/Kit";
import PageHead from "@/components/site/PageHead";
import {
  CtaBlock,
  IconCards,
  ReviewsBlock,
  ShowcaseSplit,
  StatsBlock,
} from "@/components/site/Blocks";
import { SavingsBlock } from "@/components/site/PricingBlocks";
import { getPageSections, pick } from "@/lib/cms/pages";
import { getTestimonials } from "@/lib/cms/collections";
import { pageMetadata } from "@/lib/cms/seo";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/avantages");
}

/* Couleurs des sections colorées, dans l'ordre de la page. */
const TINTS: Tint[] = ["teal", "blue", "violet", "amber", "sky"];

export default async function AvantagesPage() {
  const [sections, testimonials] = await Promise.all([
    getPageSections("/avantages"),
    getTestimonials(),
  ]);
  const hero = pick(sections, "hero", "page_hero");
  const showcases = [
    pick(sections, "showcase_1", "showcase"),
    pick(sections, "showcase_2", "showcase"),
    pick(sections, "showcase_3", "showcase"),
    pick(sections, "showcase_4", "showcase"),
    pick(sections, "showcase_5", "showcase"),
  ];
  const savings = pick(sections, "savings", "savings_compare");
  const reviews = pick(sections, "reviews", "reviews");
  const stats = pick(sections, "stats", "stats_band");
  const portal = pick(sections, "portal", "portal_cards");
  const cta = pick(sections, "cta", "cta_panel");

  /* Une couleur par section colorée, dans l'ordre de la page. */
  const tints = showcases.reduce<Tint[]>((acc, section) => {
    const n = acc.filter((t) => t !== "white").length;
    acc.push(section.tone === "white" ? "white" : TINTS[n % TINTS.length]);
    return acc;
  }, []);

  return (
    <>
      <PageHead
        content={hero}
        crumbs={[
          { label: "Accueil", href: "/" },
          { label: "Avantages", href: "/avantages" },
        ]}
        variant={1}
      />

      {showcases.map((section, i) => (
        <Section key={section.title} tint={tints[i]} edge={tints[i] === "white" ? undefined : i}>
          <ShowcaseSplit content={section} variant={i + 3} phone={section.mockup === "pwa"} />
        </Section>
      ))}

      <Section center>
        <Head eyebrow={savings.kicker} title={savings.title} lead={savings.lead} centered />
        <SavingsBlock content={savings} />
      </Section>

      <Section tint="amber" edge={5} center>
        <Head eyebrow={reviews.kicker} title={reviews.title} centered />
        <ReviewsBlock people={testimonials} />
      </Section>

      <Section center>
        <Head eyebrow={stats.kicker} title={stats.title} centered />
        <StatsBlock stats={stats.stats} onWhite />
      </Section>

      <Section tint="teal" edge={0} center>
        <Head eyebrow={portal.kicker} title={portal.title} centered />
        <IconCards
          items={portal.cards.map((c) => ({
            icon: c.icon,
            title: c.title,
            text: c.text,
            href: c.href,
            linkLabel: portal.linkLabel,
            stat: c.stat,
          }))}
        />
      </Section>

      <Section tight>
        <CtaBlock
          kicker={cta.kicker}
          title={cta.title}
          lead={cta.lead}
          primary={cta.primary}
          secondary={cta.secondary}
          trust={cta.trust}
        />
      </Section>
    </>
  );
}
