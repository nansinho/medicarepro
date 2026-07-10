import type { Metadata } from "next";
import FeaturesHero from "@/components/FeaturesHero";
import FeatureShowcase from "@/components/FeatureShowcase";
import StatsBand from "@/components/cms/StatsBand";
import PortalCards from "@/components/cms/PortalCards";
import CtaPanel from "@/components/cms/CtaPanel";
import { getPageSections, pick } from "@/lib/cms/pages";
import { getFeatureItems } from "@/lib/cms/collections";
import { pageMetadata } from "@/lib/cms/seo";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/fonctionnalites");
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

  /* Alternance de fonds + photos des sections vedettes : portées par la
     section `feature_showcase` (tones/backgrounds adressés par index). */
  const items = showcase.limit ? features.slice(0, showcase.limit) : features;

  return (
    <>
      <FeaturesHero content={hero} />

      {/* 10 sections détaillées, alternance de fonds + 2 sections vedettes foncées */}
      {items.map((feature, i) => (
        <FeatureShowcase
          key={feature.title}
          feature={feature}
          reverse={i % 2 === 1}
          tone={showcase.tones?.[i] ?? "white"}
          bgImage={
            showcase.backgrounds?.find((bg) => bg.index === i)?.image.path
          }
        />
      ))}

      {/* Bande de statistiques — bandeau foncé immersif */}
      <StatsBand content={stats} />

      {/* Grandes cartes immersives vers les pages connexes */}
      <PortalCards content={portal} tone="soft" />

      {/* CTA final spectaculaire */}
      <CtaPanel content={cta} />
    </>
  );
}
