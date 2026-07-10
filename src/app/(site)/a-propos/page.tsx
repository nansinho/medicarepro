import type { Metadata } from "next";
import { PageHero, Values, CrossLinks } from "@/components/Sections";
import { CtaBand } from "@/components/Sections2";
import Reviews from "@/components/Reviews";
import BilansTimeline from "@/components/BilansTimeline";
import StatsBand from "@/components/cms/StatsBand";
import Reveal from "@/components/motion/Reveal";
import { emphasize } from "@/components/cms/inline";
import { getPageSections, pick } from "@/lib/cms/pages";
import { getTestimonials } from "@/lib/cms/collections";
import { pageMetadata } from "@/lib/cms/seo";
import ab from "@/components/about.module.css";

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
      <PageHero
        kicker={hero.kicker ?? ""}
        title={hero.title}
        lead={hero.lead}
        image={hero.image?.path}
        imagePos={hero.imagePos}
      />

      {/* Notre histoire — récit + timeline des jalons */}
      <section className={`${ab.story} tone-white`}>
        <div className="wrap">
          <div className={ab.storyGrid}>
            <Reveal variant="left" className={ab.storyText}>
              <div className="kicker">{story.kicker}</div>
              <h2 className={ab.storyTitle}>{story.title}</h2>
              {story.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 40)}>
                  {emphasize(paragraph, (segment, key) => (
                    <strong key={key}>{segment}</strong>
                  ))}
                </p>
              ))}
              {story.signature && (
                <div className={ab.storySign}>{story.signature}</div>
              )}
            </Reveal>
            <div>
              <BilansTimeline steps={timeline.steps} />
            </div>
          </div>
        </div>
      </section>

      {/* Chiffres clés — bandeau foncé immersif */}
      <StatsBand content={stats} />

      {/* Nos engagements — le cœur du « pourquoi » de MediCare Pro */}
      <Values tone="soft" content={values} />

      {/* Preuve sociale : ceux qui nous font confiance */}
      <Reviews content={reviews} people={testimonials} />

      <CrossLinks links={crossLinks.links} />
      <CtaBand tone={ctaBand.tone} content={ctaBand} />
    </>
  );
}
