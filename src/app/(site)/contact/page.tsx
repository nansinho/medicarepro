import type { Metadata } from "next";
import { Fragment } from "react";
import { PageHero, CrossLinks } from "@/components/Sections";
import ContactSection from "@/components/ContactSection";
import Reveal from "@/components/motion/Reveal";
import StaggerGroup from "@/components/motion/StaggerGroup";
import StaggerItem from "@/components/motion/StaggerItem";
import { getPageSections, pick } from "@/lib/cms/pages";
import { pageMetadata } from "@/lib/cms/seo";
import c from "@/components/contact.module.css";

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
      <PageHero
        kicker={hero.kicker ?? ""}
        title={hero.title}
        lead={hero.lead}
        image={hero.image?.path}
      />

      {/* Canaux de contact + formulaire premium */}
      <ContactSection content={channels} />

      {/* Ce qui se passe après l'envoi du message */}
      <section className={`${c.stepsSec} tone-soft`}>
        <div className="wrap">
          <Reveal className="sec-head">
            <div className="kicker">{steps.kicker}</div>
            <h2 className="sec-title">{steps.title}</h2>
          </Reveal>
          <StaggerGroup className={c.steps}>
            {steps.steps.map((step, i) => (
              <Fragment key={step.title}>
                {i > 0 && <span className={c.stepLink} aria-hidden="true" />}
                <StaggerItem className={c.step} variant="up">
                  <div className={c.stepNum}>{i + 1}</div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </StaggerItem>
              </Fragment>
            ))}
          </StaggerGroup>
          <CrossLinks links={crossLinks.links} />
        </div>
      </section>
    </>
  );
}
