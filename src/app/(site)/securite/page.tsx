import type { Metadata } from "next";
import { OvhLogo } from "@/components/icons";
import { Head, Section, Split } from "@/components/site/Kit";
import PageHead from "@/components/site/PageHead";
import { CtaBlock, IconCards, ShowcaseSplit, StatsBlock } from "@/components/site/Blocks";
import { CardFrame } from "@/components/site/Visuals";
import { getPageSections, pick } from "@/lib/cms/pages";
import { pageMetadata } from "@/lib/cms/seo";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/securite");
}

export default async function SecuritePage() {
  const sections = await getPageSections("/securite");
  const hero = pick(sections, "hero", "page_hero");
  const showcases = [
    pick(sections, "showcase_1", "showcase"),
    pick(sections, "showcase_2", "showcase"),
    pick(sections, "showcase_3", "showcase"),
    pick(sections, "showcase_4", "showcase"),
  ];
  const guarantees = pick(sections, "guarantees", "stats_band");
  const host = pick(sections, "host", "host_band");
  const portal = pick(sections, "portal", "portal_cards");
  const cta = pick(sections, "cta", "cta_panel");

  return (
    <>
      <PageHead
        content={hero}
        crumbs={[
          { label: "Accueil", href: "/" },
          { label: "Sécurité et HDS", href: "/securite" },
        ]}
        variant={4}
      />

      {showcases.map((section, i) => (
        <Section
          key={section.title}
          tint={section.tone === "white" ? "white" : "blue"}
          edge={i === 0 ? 1 : i === 2 ? 3 : undefined}
        >
          <ShowcaseSplit
            content={{ ...section, mockup: undefined }}
            variant={i + 2}
            color="var(--brand-indigo)"
          />
        </Section>
      ))}

      <Section tint="violet" edge={2} center>
        <Head eyebrow={guarantees.kicker} title={guarantees.title} centered />
        <StatsBlock stats={guarantees.stats} />
      </Section>

      {/* Hébergeur : le logo OVHcloud posé sur une forme */}
      <Section>
        <Split
          reverse
          visual={
            <CardFrame variant={5}>
              <span style={{ display: "grid", justifyItems: "center", gap: 10 }}>
                <OvhLogo style={{ width: 112, height: 112, color: "#000e9c" }} />
                <b style={{ font: "700 30px/1 var(--font-body)", color: "#000e9c" }}>OVHcloud</b>
              </span>
              <span style={{ fontWeight: 600, color: "var(--site-ink)" }}>{host.logoCaption}</span>
            </CardFrame>
          }
          eyebrow={host.kicker}
          title={host.title}
          text={host.text}
          items={host.points}
          starColor="var(--brand-indigo)"
          cta={{ label: "Poser une question", href: "/contact" }}
        />
      </Section>

      <Section tint="violet" edge={0} center>
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
