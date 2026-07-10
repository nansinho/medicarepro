import type { Metadata } from "next";
import SecurityHero from "@/components/SecurityHero";
import SecurityShowcase from "@/components/SecurityShowcase";
import StatsBand from "@/components/cms/StatsBand";
import PortalCards from "@/components/cms/PortalCards";
import CtaPanel from "@/components/cms/CtaPanel";
import Reveal from "@/components/motion/Reveal";
import { OvhLogo, Check } from "@/components/icons";
import { getPageSections, pick } from "@/lib/cms/pages";
import { pageMetadata } from "@/lib/cms/seo";
import sec from "@/components/security.module.css";

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
      <SecurityHero content={hero} />

      {/* 4 sections immersives (photos serveurs), alternées + 2 vedettes foncées */}
      {showcases.map((section) => (
        <SecurityShowcase
          key={section.title}
          icon={section.icon}
          kicker={section.kicker}
          title={section.title}
          text={section.text}
          points={section.points}
          image={section.image?.path ?? ""}
          alt={section.image?.alt ?? ""}
          tone={section.tone}
          reverse={section.reverse}
        />
      ))}

      {/* Bande de garanties — bandeau foncé immersif avec compteurs animés */}
      <StatsBand content={guarantees} />

      {/* Bande hébergeur — mise en avant du logo OVHcloud */}
      <section className={`${sec.host} tone-soft`}>
        <div className="wrap">
          <div className={sec.hostInner}>
            <Reveal variant="left" className={sec.hostLogoCard}>
              <OvhLogo className={sec.hostLogo} />
              <span className={sec.hostLogoCaption}>{host.logoCaption}</span>
            </Reveal>
            <Reveal variant="right" className={sec.hostBody}>
              <div className={sec.hostKicker}>{host.kicker}</div>
              <h2 className={sec.hostTitle}>{host.title}</h2>
              <p className={sec.hostText}>{host.text}</p>
              <ul className={sec.hostPoints}>
                {host.points.map((point) => (
                  <li key={point}>
                    <span className={sec.hostTick}>
                      <Check width={13} height={13} />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Grandes cartes immersives vers les pages connexes */}
      <PortalCards content={portal} tone="white" />

      {/* CTA final spectaculaire */}
      <CtaPanel content={cta} />
    </>
  );
}
