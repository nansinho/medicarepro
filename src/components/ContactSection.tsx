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
  AlertTriangle,
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
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (sending) return;
    setError(null);
    setSending(true);

    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "L'envoi a échoué.");
      }
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "L'envoi a échoué. Réessayez ou écrivez-nous directement.",
      );
    } finally {
      setSending(false);
    }
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
                <form onSubmit={onSubmit} noValidate>
                  <h3 className={c.formTitle}>{content.form.title}</h3>
                  <p className={c.formSub}>{content.form.sub}</p>
                  <div className={c.grid2}>
                    <div className={c.field}>
                      <label htmlFor="name">Nom</label>
                      <input
                        id="name"
                        name="name"
                        type="text"
                        placeholder="Votre nom"
                        autoComplete="name"
                        required
                      />
                    </div>
                    <div className={c.field}>
                      <label htmlFor="email">Email</label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="vous@cabinet.fr"
                        autoComplete="email"
                        required
                      />
                    </div>
                  </div>
                  <div className={c.grid2}>
                    <div className={c.field}>
                      <label htmlFor="tel">Téléphone</label>
                      <input
                        id="tel"
                        name="tel"
                        type="tel"
                        placeholder="06 00 00 00 00"
                        autoComplete="tel"
                      />
                    </div>
                    <div className={c.field}>
                      <label htmlFor="praticiens">Nombre de praticiens</label>
                      <select id="praticiens" name="praticiens" defaultValue="1">
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
                      name="message"
                      rows={4}
                      placeholder="Parlez-nous de votre cabinet..."
                    />
                  </div>
                  {/* Honeypot anti-spam : masqué, ignoré par l'API si rempli. */}
                  <div className={c.hp} aria-hidden="true">
                    <label htmlFor="company">Ne pas remplir</label>
                    <input
                      id="company"
                      name="company"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                    />
                  </div>
                  <label className={c.consent}>
                    <input type="checkbox" required />
                    {content.form.consent}
                  </label>
                  {error && (
                    <p className={c.formError} role="alert">
                      <AlertTriangle width={18} height={18} />
                      {error}
                    </p>
                  )}
                  <button
                    className={`btn ${c.sendBtn}`}
                    type="submit"
                    disabled={sending}
                  >
                    {sending ? "Envoi en cours…" : content.form.submitLabel}{" "}
                    <ArrowRight className="ico ar" />
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
