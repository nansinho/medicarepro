import type { Metadata } from "next";
import { Btn, Eyebrow, Head, Paras, Section, Title } from "@/components/site/Kit";
import PageHead from "@/components/site/PageHead";
import {
  CtaBlock,
  IconCards,
  LinksRow,
  ReviewsBlock,
  Signature,
  StatsBlock,
  TimelineList,
} from "@/components/site/Blocks";
import { getPageSections, pick } from "@/lib/cms/pages";
import { getTestimonials } from "@/lib/cms/collections";
import { pageMetadata } from "@/lib/cms/seo";
import k from "@/components/site/kit.module.css";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/a-propos");
}

export default async function AProposPage() {
  const [sections, testimonials] = await Promise.all([
    getPageSections("/a-propos"),
    getTestimonials(),
  ]);
  const hero = pick(sections, "hero", "page_hero");
  const story = pick(sections, "story", "story");
  const timeline = pick(sections, "timeline", "timeline");
  const stats = pick(sections, "stats", "stats_band");
  const values = pick(sections, "values", "values");
  const reviews = pick(sections, "reviews", "reviews");
  const crossLinks = pick(sections, "cross_links", "cross_links");
  const ctaBand = pick(sections, "cta_band", "cta_band");

  return (
    <>
      <PageHead
        content={hero}
        crumbs={[
          { label: "Accueil", href: "/" },
          { label: "Qui sommes-nous ?", href: "/a-propos" },
        ]}
        variant={5}
        imagePosition={hero.imagePos ?? "center 45%"}
      />

      {/* Notre histoire : le récit à gauche, la frise à droite */}
      <Section tint="amber" edge={0}>
        <div className={`${k.two}`} style={{ alignItems: "start" }}>
          <div data-rv-kit="">
            <Eyebrow>{story.kicker}</Eyebrow>
            <Title>{story.title}</Title>
            <div className={k.text} style={{ marginTop: 18 }}>
              <Paras text={story.paragraphs.join("\n\n")} />
            </div>
            {story.signature && <Signature>{story.signature}</Signature>}
          </div>
          <TimelineList steps={timeline.steps} ring="var(--tint-amber)" />
        </div>
      </Section>

      <Section center>
        <Head eyebrow={stats.kicker} title={stats.title} centered />
        <StatsBlock stats={stats.stats} onWhite />
      </Section>

      <Section tint="violet" edge={2} center>
        <Head eyebrow={values.kicker} title={values.title} centered />
        <IconCards items={values.items} cols={3} />
        {values.teaserHref && (
          <div className={k.row} style={{ justifyContent: "center" }}>
            <Btn href={values.teaserHref} variant="outline" size="lg">
              Tous les avantages
            </Btn>
          </div>
        )}
      </Section>

      <Section center>
        <Head eyebrow={reviews.kicker} title={reviews.title} centered />
        <ReviewsBlock people={testimonials} />
      </Section>

      <Section tight>
        <CtaBlock
          title={ctaBand.title}
          lead={ctaBand.text}
          primary={ctaBand.cta}
          secondary={{ label: "Demander une démo", href: "/contact" }}
        />
        <div style={{ marginTop: 40 }}>
          <LinksRow links={crossLinks.links} />
        </div>
      </Section>
    </>
  );
}
