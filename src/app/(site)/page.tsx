import type { Metadata } from "next";
import Link from "next/link";
import Hero from "@/components/Hero";
import HomeBento from "@/components/HomeBento";
import HomeFeatureScroll from "@/components/HomeFeatureScroll";
import Reviews from "@/components/Reviews";
import CtaPanel from "@/components/cms/CtaPanel";
import Reveal from "@/components/motion/Reveal";
import { ArrowRight } from "@/components/icons";
import { lines } from "@/components/cms/inline";
import { getPageSections, pick } from "@/lib/cms/pages";
import { getFeatureItems, getTestimonials } from "@/lib/cms/collections";
import { pageMetadata } from "@/lib/cms/seo";
import h from "@/components/home.module.css";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/");
}

export default async function Home() {
  const [sections, features, testimonials] = await Promise.all([
    getPageSections("/"),
    getFeatureItems("features"),
    getTestimonials(),
  ]);
  const hero = pick(sections, "hero", "home_hero");
  const bento = pick(sections, "bento", "bento");
  const featureScroll = pick(sections, "feature_scroll", "feature_scroll");
  const manifesto = pick(sections, "manifesto", "manifesto");
  const reviews = pick(sections, "reviews", "reviews");
  const cta = pick(sections, "cta", "cta_panel");

  return (
    <>
      <Hero content={hero} />

      {/* L'essentiel du produit en une grille bento animée */}
      <HomeBento content={bento} />

      {/* Défilement cinématique « sticky » des fonctionnalités clés */}
      <HomeFeatureScroll content={featureScroll} items={features} />

      {/* Manifesto immersif — le « pourquoi » en une phrase */}
      <section className={h.manifesto}>
        <div className="wrap">
          <Reveal variant="scale" className={h.manifestoInner}>
            <div className={h.manifestoKicker}>{manifesto.kicker}</div>
            <h2 className={h.manifestoTitle}>{lines(manifesto.title)}</h2>
            <p className={h.manifestoText}>{manifesto.text}</p>
            {manifesto.link && (
              <Link href={manifesto.link.href} className={h.manifestoLink}>
                {manifesto.link.label} <ArrowRight width={16} height={16} />
              </Link>
            )}
          </Reveal>
        </div>
      </section>

      {/* Preuve sociale */}
      <Reviews content={reviews} people={testimonials} />

      {/* CTA final spectaculaire */}
      <CtaPanel content={cta} />
    </>
  );
}
