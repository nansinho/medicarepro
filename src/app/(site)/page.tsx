import type { Metadata } from "next";
import { Badges, Section } from "@/components/site/Kit";
import PageHead from "@/components/site/PageHead";
import {
  BlogTeaserBlock,
  EssentialsBlock,
  FaqBlock,
  OfferBlock,
  ShowcaseSplit,
} from "@/components/site/Blocks";
import { Calculator, FileSignature, Invoice, Lock, ShieldCheck } from "@/components/icons";
import { getPageSections, pick } from "@/lib/cms/pages";
import { getFaqItems } from "@/lib/cms/collections";
import { getPosts } from "@/lib/cms/posts";
import { pageMetadata } from "@/lib/cms/seo";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/");
}

/* Pastilles de conformité sous la photo « complet et conforme ». */
const COMPLIANCE = [
  { label: "HDS", color: "var(--brand-indigo)", icon: <ShieldCheck aria-hidden="true" /> },
  { label: "RGPD", color: "var(--brand-green-ink)", icon: <Lock aria-hidden="true" /> },
  { label: "eIDAS", color: "var(--brand-violet)", icon: <FileSignature aria-hidden="true" /> },
  { label: "Carte Vitale · ApCV", color: "var(--brand-teal-ink)", icon: <Invoice aria-hidden="true" /> },
  { label: "Export FEC", color: "var(--brand-amber-ink)", icon: <Calculator aria-hidden="true" /> },
];

export default async function Home() {
  const [sections, faqItems, posts] = await Promise.all([
    getPageSections("/"),
    getFaqItems(),
    getPosts(),
  ]);
  const hero = pick(sections, "hero_split", "page_hero");
  const essentials = pick(sections, "essentials", "essentials");
  const complete = pick(sections, "complete", "showcase");
  const offer = pick(sections, "offer", "offer_band");
  const included = pick(sections, "included", "showcase");
  const charge = pick(sections, "charge", "showcase");
  const why = pick(sections, "why", "showcase");
  const faq = pick(sections, "faq", "faq");
  const blog = pick(sections, "blog", "blog_teaser");

  return (
    <>
      <PageHead content={hero} variant={0} />

      <Section tint="violet" edge={0} center>
        <EssentialsBlock content={essentials} />
      </Section>

      <Section>
        <ShowcaseSplit
          content={complete}
          variant={0}
          visualAfter={<Badges items={COMPLIANCE} />}
        />
      </Section>

      <Section tint="white" tight>
        <OfferBlock content={offer} />
      </Section>

      <Section tint="blue" edge={1}>
        <ShowcaseSplit content={included} variant={1} phone />
      </Section>

      <Section tint="violet" edge={2}>
        <ShowcaseSplit content={charge} variant={1} />
      </Section>

      <Section>
        <ShowcaseSplit content={why} variant={3} />
      </Section>

      <Section tint="violet" edge={5}>
        <FaqBlock kicker={faq.kicker} title={faq.title} items={faqItems} id="faq" />
      </Section>

      {posts.length > 0 && (
        <Section>
          <BlogTeaserBlock content={blog} posts={posts} />
        </Section>
      )}
    </>
  );
}
