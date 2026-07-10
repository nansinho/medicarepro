"use client";

import { useState, type FormEvent } from "react";
import Reveal from "@/components/motion/Reveal";
import StaggerGroup from "@/components/motion/StaggerGroup";
import StaggerItem from "@/components/motion/StaggerItem";
import {
  Mail,
  Phone,
  Headset,
  ShieldCheck,
  ArrowRight,
  CircleCheck,
} from "./icons";
import type { SectionContentOf } from "@/lib/cms/sections.schema";
import c from "./contact.module.css";

/* Icônes des canaux de contact (clés string du contenu CMS). */
const ICONS = { Mail, Phone, Headset } as const;

/**
 * Section principale de la page Contact : canaux de contact à gauche
 * (email, téléphone, démo en visio), formulaire premium à droite.
 * La microcopie éditoriale vient du CMS (`contact_channels`) ; les labels
 * et placeholders des champs restent dans le composant (structure).
 */
export default function ContactSection({
  content,
}: {
  content: SectionContentOf<"contact_channels">;
}) {
  const [sent, setSent] = useState(false);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // TODO(backend): l'envoi est SIMULÉ — aucun message n'est réellement transmis.
    // À brancher avec le backend Supabase (cf. MIGRATION.md, phase backend) :
    // POST vers une route API (/api/contact) qui enregistre la demande et/ou
    // envoie un email à contact@medicarepro.fr, avec validation + anti-spam.
    setSent(true);
  };

  return (
    <section className={`${c.contactSec} tone-white`}>
      <div className="wrap">
        <div className={c.grid}>
          {/* Canaux de contact */}
          <div>
            <Reveal variant="left">
              <div className="kicker">{content.kicker}</div>
              <h2 className={c.sideTitle}>{content.title}</h2>
              <p className={c.sideText}>{content.text}</p>
            </Reveal>

            <StaggerGroup className={c.chans}>
              {content.channels.map((channel) => {
                const Icon = ICONS[channel.icon as keyof typeof ICONS];
                const body = (
                  <>
                    <span className={c.chanIco}>
                      <Icon width={24} height={24} />
                    </span>
                    <span className={c.chanBody}>
                      <b>{channel.title}</b>
                      <span>{channel.value}</span>
                      <small>{channel.note}</small>
                    </span>
                  </>
                );
                return (
                  <StaggerItem variant="left" key={channel.title}>
                    {channel.href ? (
                      <a href={channel.href} className={c.chan}>
                        {body}
                      </a>
                    ) : (
                      /* Canal sans lien (démo en visio) : carte mise en avant. */
                      <div className={`${c.chan} ${c.chanStar}`}>{body}</div>
                    )}
                  </StaggerItem>
                );
              })}
            </StaggerGroup>

            <Reveal variant="up" delay={0.2}>
              <div className={c.hdsLine}>
                <span className={c.hdsDot} aria-hidden="true" />
                {content.hdsLine}
              </div>
            </Reveal>
          </div>

          {/* Formulaire */}
          <Reveal variant="right">
            <div className={c.formCard}>
              {sent ? (
                <div className={c.sent}>
                  <span className={c.sentIco}>
                    <CircleCheck width={40} height={40} />
                  </span>
                  <h3>{content.form.successTitle}</h3>
                  <p>{content.form.successText}</p>
                </div>
              ) : (
                <form onSubmit={onSubmit}>
                  <h3 className={c.formTitle}>{content.form.title}</h3>
                  <p className={c.formSub}>{content.form.sub}</p>
                  <div className={c.grid2}>
                    <div className={c.field}>
                      <label htmlFor="name">Nom</label>
                      <input
                        id="name"
                        type="text"
                        placeholder="Votre nom"
                        required
                      />
                    </div>
                    <div className={c.field}>
                      <label htmlFor="email">Email</label>
                      <input
                        id="email"
                        type="email"
                        placeholder="vous@cabinet.fr"
                        required
                      />
                    </div>
                  </div>
                  <div className={c.grid2}>
                    <div className={c.field}>
                      <label htmlFor="tel">Téléphone</label>
                      <input id="tel" type="tel" placeholder="06 00 00 00 00" />
                    </div>
                    <div className={c.field}>
                      <label htmlFor="praticiens">Nombre de praticiens</label>
                      <select id="praticiens" defaultValue="1">
                        <option value="1">1 (libéral)</option>
                        <option value="2-3">2 à 3</option>
                        <option value="4+">4 et plus</option>
                      </select>
                    </div>
                  </div>
                  <div className={c.field}>
                    <label htmlFor="message">Message</label>
                    <textarea
                      id="message"
                      rows={4}
                      placeholder="Parlez-nous de votre cabinet..."
                    />
                  </div>
                  <label className={c.consent}>
                    <input type="checkbox" required />
                    {content.form.consent}
                  </label>
                  <button className={`btn ${c.sendBtn}`} type="submit">
                    {content.form.submitLabel} <ArrowRight className="ico ar" />
                  </button>
                  <div className={c.formFoot}>
                    <ShieldCheck width={18} height={18} />
                    {content.form.footNote}
                  </div>
                </form>
              )}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
