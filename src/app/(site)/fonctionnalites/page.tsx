import type { Metadata } from "next";
import { Head, Section, type Tint } from "@/components/site/Kit";
import PageHead from "@/components/site/PageHead";
import { CtaBlock, IconCards, ShowcaseSplit, StatsBlock } from "@/components/site/Blocks";
import { ACCENT_BY_MOCKUP, ANCHOR_BY_MOCKUP } from "@/components/site/palette";
import type { Accent, ToneWithDark } from "@/lib/cms/sections.schema";
import { getPageSections, pick } from "@/lib/cms/pages";
import { getFeatureItems } from "@/lib/cms/collections";
import { pageMetadata } from "@/lib/cms/seo";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/fonctionnalites");
}

/* Fond d'une section de fonctionnalité : blanc, ou la teinte douce de son
   module (la tonalité du CMS dit « coloré ou non », le module dit la couleur).
   Pas de fond vert d'eau : les modules turquoise et vert passent en bleu
   ciel (pas en ambre : la section chiffres qui suit les vitrines l'est déjà). */
const TINT_BY_ACCENT: Record<Accent, Tint> = {
  blue: "blue",
  teal: "sky",
  violet: "violet",
  amber: "amber",
  green: "sky",
  sky: "sky",
  indigo: "blue",
};

function tintFor(tone: ToneWithDark | undefined, accent: Accent): Tint {
  return !tone || tone === "white" ? "white" : TINT_BY_ACCENT[accent];
}

export default async function FonctionnalitesPage() {
  const [sections, features] = await Promise.all([
    getPageSections("/fonctionnalites"),
    getFeatureItems("features"),
  ]);
  const hero = pick(sections, "hero", "page_hero");
  const showcase = pick(sections, "showcase", "feature_showcase");
  const stats = pick(sections, "stats", "stats_band");
  const portal = pick(sections, "portal", "portal_cards");
  const cta = pick(sections, "cta", "cta_panel");

  const items = showcase.limit ? features.slice(0, showcase.limit) : features;

  return (
    <>
      <PageHead
        content={hero}
        crumbs={[
          { label: "Accueil", href: "/" },
          { label: "Fonctionnalités", href: "/fonctionnalites" },
        ]}
        variant={2}
      />

      {items.map((feature, i) => {
        const accent = ACCENT_BY_MOCKUP[feature.mockup];
        return (
          <Section
            key={feature.title}
            id={ANCHOR_BY_MOCKUP[feature.mockup]}
            tint={tintFor(showcase.tones?.[i], accent)}
            edge={i % 3 === 1 ? i : undefined}
          >
            <ShowcaseSplit
              content={{
                kicker: feature.kicker,
                title: feature.title,
                text: feature.text,
                points: feature.points,
                mockup: feature.mockup,
                cta: feature.href
                  ? { label: feature.hrefLabel ?? "En savoir plus", href: feature.href }
                  : undefined,
              }}
              reverse={i % 2 === 1}
              variant={i}
              phone={feature.mockup === "portal" || feature.mockup === "pwa"}
            />
          </Section>
        );
      })}

      <Section tint="amber" edge={5} center>
        <Head eyebrow={stats.kicker} title={stats.title} centered />
        <StatsBlock stats={stats.stats} />
      </Section>

      <Section center>
        <Head eyebrow={portal.kicker} title={portal.title} centered />
        <IconCards
          onWhite
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
