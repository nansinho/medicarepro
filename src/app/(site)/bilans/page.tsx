import type { Metadata } from "next";
import { Head, Section, Title, type Tint } from "@/components/site/Kit";
import PageHead from "@/components/site/PageHead";
import {
  CtaBlock,
  IconCards,
  LinksRow,
  ShowcaseSplit,
  StatsBlock,
  StepsBlock,
} from "@/components/site/Blocks";
import { getPageSections, pick } from "@/lib/cms/pages";
import { getFeatureItems } from "@/lib/cms/collections";
import { pageMetadata } from "@/lib/cms/seo";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/bilans");
}

/* Couleurs des bilans mis en avant sur fond coloré, dans l'ordre de la
   page (la section « groupes » plus bas est déjà violette). */
const TINTS: Tint[] = ["sky", "amber"];

export default async function BilansPage() {
  const [sections, bilans] = await Promise.all([
    getPageSections("/bilans"),
    getFeatureItems("bilans"),
  ]);
  const hero = pick(sections, "hero", "page_hero");
  const showcase = pick(sections, "showcase", "feature_showcase");
  const benefits = pick(sections, "benefits", "benefit_band");
  const groups = pick(sections, "groups", "bilan_groups");
  const steps = pick(sections, "steps", "timeline");
  const stats = pick(sections, "stats", "stats_band");
  const cta = pick(sections, "cta", "cta_panel");
  const crossLinks = pick(sections, "cross_links", "cross_links");

  const items = showcase.limit ? bilans.slice(0, showcase.limit) : bilans;
  const tints = items.reduce<Tint[]>((acc, _, i) => {
    const tone = showcase.tones?.[i];
    const n = acc.filter((t) => t !== "white").length;
    acc.push(!tone || tone === "white" ? "white" : TINTS[n % TINTS.length]);
    return acc;
  }, []);

  return (
    <>
      <PageHead
        content={hero}
        crumbs={[
          { label: "Accueil", href: "/" },
          { label: "Bilans podologiques", href: "/bilans" },
        ]}
        variant={3}
      />

      {/* Les bilans phares, chacun avec son écran dans le logiciel */}
      {items.map((item, i) => (
        <Section
          key={item.title}
          tint={tints[i]}
          edge={i === 0 ? 3 : i === 2 ? 1 : undefined}
        >
          <ShowcaseSplit
            content={{
              kicker: item.kicker,
              title: item.title,
              text: item.text,
              points: item.points,
              mockup: item.mockup,
            }}
            reverse={i % 2 === 1}
            variant={i + 1}
          />
        </Section>
      ))}

      <Section center>
        <Head eyebrow={benefits.kicker} title={benefits.title} centered />
        <IconCards items={benefits.items} cols={4} onWhite />
      </Section>

      {/* Les 13 bilans, par famille */}
      <Section tint="violet" edge={4}>
        <Head eyebrow={groups.kicker} title={groups.title} centered />
        {groups.groups.map((group, gi) => (
          <div key={group.title} style={{ marginTop: gi === 0 ? 0 : 56 }}>
            <div style={{ marginBottom: 24 }}>
              <Title as="h3">{group.title}</Title>
            </div>
            <IconCards items={group.items} cols={4} />
          </div>
        ))}
      </Section>

      <Section center>
        <Head eyebrow={steps.kicker} title={steps.title ?? "Comment ça marche"} centered />
        <StepsBlock steps={steps.steps} onWhite />
      </Section>

      <Section tint="amber" edge={5} center>
        <Head eyebrow={stats.kicker} title={stats.title} centered />
        <StatsBlock stats={stats.stats} />
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
        <div style={{ marginTop: 40 }}>
          <LinksRow links={crossLinks.links} />
        </div>
      </Section>
    </>
  );
}
