import type { Metadata } from "next";
import AvantagesHero from "@/components/AvantagesHero";
import AvantagesShowcase from "@/components/AvantagesShowcase";
import SavingsCompare from "@/components/SavingsCompare";
import Reviews from "@/components/Reviews";
import StatsBand from "@/components/cms/StatsBand";
import PortalCards from "@/components/cms/PortalCards";
import CtaPanel from "@/components/cms/CtaPanel";
import { getPageSections, pick } from "@/lib/cms/pages";
import { getTestimonials } from "@/lib/cms/collections";
import { pageMetadata } from "@/lib/cms/seo";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/avantages");
}

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

  return (
    <>
      <AvantagesHero content={hero} />

      {/* 5 sections immersives, alternées + 2 vedettes foncées */}
      {showcases.map((section) => (
        <AvantagesShowcase
          key={section.title}
          icon={section.icon}
          kicker={section.kicker}
          title={section.title}
          text={section.text}
          points={section.points}
          mockup={section.mockup}
          image={section.image?.path}
          alt={section.image?.alt}
          tone={section.tone}
          reverse={section.reverse}
        />
      ))}

      {/* Comparatif économies */}
      <SavingsCompare content={savings} />

      {/* Témoignages clients (composant réutilisé) */}
      <Reviews content={reviews} people={testimonials} />

      {/* Bande de stats animées — vedette foncée immersive */}
      <StatsBand content={stats} />

      {/* Grandes cartes immersives vers les pages connexes */}
      <PortalCards content={portal} tone="soft" />

      {/* CTA final spectaculaire */}
      <CtaPanel content={cta} />
    </>
  );
}
