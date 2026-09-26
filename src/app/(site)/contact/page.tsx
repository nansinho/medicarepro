import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Head, Section, fr } from "@/components/site/Kit";
import PageHead from "@/components/site/PageHead";
import ContactForm from "@/components/site/ContactForm";
import { LinksRow, StepsBlock } from "@/components/site/Blocks";
import { Icon } from "@/components/site/icon";
import { ACCENTS, CYCLE } from "@/components/site/palette";
import { getPageSections, pick } from "@/lib/cms/pages";
import { pageMetadata } from "@/lib/cms/seo";
import f from "@/components/site/form.module.css";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/contact");
}

export default async function ContactPage() {
  const sections = await getPageSections("/contact");
  const hero = pick(sections, "hero", "page_hero");
  const channels = pick(sections, "channels", "contact_channels");
  const steps = pick(sections, "steps", "contact_steps");
  const crossLinks = pick(sections, "cross_links", "cross_links");

  return (
    <>
      <PageHead
        content={hero}
        crumbs={[
          { label: "Accueil", href: "/" },
          { label: "Contact", href: "/contact" },
        ]}
        textOnly
      />

      <Section tint="blue" edge={3}>
        <div className={f.grid}>
          <ContactForm texts={channels.form} />
          <div className={f.side}>
            <h2>{fr(channels.title)}</h2>
            <p>{fr(channels.text)}</p>
            <div className={f.chans}>
              {channels.channels.map((ch, i) => {
                const a = ACCENTS[CYCLE[i % CYCLE.length]];
                const body = (
                  <>
                    <span className={f.chanIco} style={{ "--c": a.c, "--t": a.t } as CSSProperties}>
                      <Icon name={ch.icon} />
                    </span>
                    <span>
                      <b>{ch.title}</b>
                      <span>{ch.value}</span>
                      <small>{ch.note}</small>
                    </span>
                  </>
                );
                return ch.href ? (
                  <a key={ch.title} href={ch.href} className={f.chan}>
                    {body}
                  </a>
                ) : (
                  <div key={ch.title} className={f.chan}>
                    {body}
                  </div>
                );
              })}
            </div>
            <p className={f.hds}>
              <i aria-hidden="true" />
              {channels.hdsLine}
            </p>
          </div>
        </div>
      </Section>

      <Section center>
        <Head eyebrow={steps.kicker} title={steps.title} centered />
        <StepsBlock steps={steps.steps} onWhite />
        <div style={{ marginTop: 48 }}>
          <LinksRow links={crossLinks.links} />
        </div>
      </Section>
    </>
  );
}
