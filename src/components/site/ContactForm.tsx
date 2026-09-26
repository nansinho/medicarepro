"use client";

import { useState, type FormEvent } from "react";
import { AlertTriangle, CircleCheck, ShieldCheck } from "@/components/icons";
import type { SectionContentOf } from "@/lib/cms/sections.schema";
import k from "./kit.module.css";
import f from "./form.module.css";

type FormTexts = SectionContentOf<"contact_channels">["form"];

/**
 * Formulaire de demande de démo : envoi réel vers /api/contact (email à
 * l'équipe, Reply-To du visiteur). Microcopie du CMS, champs fixes.
 * Aucune donnée de santé n'est demandée.
 */
export default function ContactForm({ texts }: { texts: FormTexts }) {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (sending) return;
    const form = e.currentTarget;
    if (!form.reportValidity()) return;
    setError(null);
    setSending(true);
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "L'envoi a échoué.");
      }
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "L'envoi a échoué. Réessayez ou écrivez-nous directement.",
      );
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className={f.card} role="status">
        <div className={f.sent}>
          <CircleCheck aria-hidden="true" />
          <h2>{texts.successTitle}</h2>
          <p>{texts.successText}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={f.card}>
      <h2>{texts.title}</h2>
      <p className={f.sub}>{texts.sub}</p>
      <form className={f.form} onSubmit={onSubmit} noValidate>
        <div className={f.two}>
          <div className={f.field}>
            <label htmlFor="c-name">Nom et prénom</label>
            <input id="c-name" name="name" type="text" autoComplete="name" required />
          </div>
          <div className={f.field}>
            <label htmlFor="c-email">Email professionnel</label>
            <input
              id="c-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="vous@cabinet.fr"
              required
            />
          </div>
        </div>
        <div className={f.two}>
          <div className={f.field}>
            <label htmlFor="c-tel">Téléphone</label>
            <input id="c-tel" name="tel" type="tel" autoComplete="tel" placeholder="06 00 00 00 00" />
          </div>
          <div className={f.field}>
            <label htmlFor="c-prat">Nombre de praticiens</label>
            <select id="c-prat" name="praticiens" defaultValue="1">
              <option value="1">1 praticien</option>
              <option value="2-3">2 à 3 praticiens</option>
              <option value="4+">4 praticiens ou plus</option>
            </select>
          </div>
        </div>
        <div className={f.field}>
          <label htmlFor="c-msg">Votre message</label>
          <textarea id="c-msg" name="message" rows={4} placeholder="Parlez-nous de votre cabinet…" />
        </div>
        {/* Piège à robots : masqué, ignoré par l'API s'il est rempli. */}
        <div className={f.hp} aria-hidden="true">
          <label htmlFor="c-company">Ne pas remplir</label>
          <input id="c-company" name="company" type="text" tabIndex={-1} autoComplete="off" />
        </div>
        <label className={f.consent}>
          <input type="checkbox" required />
          <span>{texts.consent}</span>
        </label>
        {error && (
          <p className={f.error} role="alert">
            <AlertTriangle aria-hidden="true" />
            {error}
          </p>
        )}
        <div>
          <button className={`${k.btn} ${k.primary} ${k.lg}`} type="submit" disabled={sending}>
            {sending ? "Envoi en cours…" : texts.submitLabel}
          </button>
        </div>
        <p className={f.foot}>
          <ShieldCheck aria-hidden="true" />
          {texts.footNote}
        </p>
      </form>
    </div>
  );
}
