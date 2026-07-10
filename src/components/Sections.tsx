import Link from "next/link";
import {
  CheckCircle,
  Grid,
  ShieldCheck,
  Lock,
  Clock,
  ArrowRight,
} from "./icons";
import type { SectionContentOf } from "@/lib/cms/sections.schema";
import s from "./sections.module.css";

/** Niveau de titre d'une section : h1 quand la section est le sujet de la
 *  page (un seul par page), h2 sinon (teaser sur la home, sous-section). */
type Heading = "h1" | "h2";

/** Tonalité de fond de la section, pilotée par la page (alternance
 *  blanc ↔ bleu clair ↔ bleu moyen). "white" par défaut. */
type Tone = "white" | "soft" | "medium";

/** Props communes aux sections « piliers » réutilisables. */
type PillarProps = {
  /** Niveau du titre principal. Défaut h2. */
  as?: Heading;
  /** Tonalité de fond (alternance pilotée par la page). Défaut "white". */
  tone?: Tone;
};

/** Classe de tonalité à concaténer sur la <section>. */
function toneClass(tone: Tone = "white") {
  if (tone === "soft") return "tone-soft";
  if (tone === "medium") return "tone-medium";
  return "tone-white";
}

/** Lien « En savoir plus → » optionnel, rendu sous une section teaser. */
function LearnMore({ href }: { href?: string }) {
  if (!href) return null;
  return (
    <div style={{ textAlign: "center" }}>
      <Link href={href} className="learn-more">
        En savoir plus <ArrowRight width={16} height={16} />
      </Link>
    </div>
  );
}

/** Rangée de liens internes entre pages connexes (maillage SEO). */
export function CrossLinks({
  links,
}: {
  links: { href: string; label: string }[];
}) {
  return (
    <nav className="cross-links" aria-label="Pages liées">
      {links.map((l) => (
        <Link key={l.href} href={l.href}>
          {l.label} <ArrowRight width={15} height={15} />
        </Link>
      ))}
    </nav>
  );
}

/* ---------------- PAGE HERO ---------------- */
/** Bandeau hero des pages intérieures : fond dégradé + h1 unique + lead.
 *  `image` pose une photo en filigrane sous le dégradé (même recette que les
 *  heros custom fonctionnalités/bilans/sécurité — opacité faible).
 *  Réutilise les utilitaires globaux .sec-head / .kicker / .sec-title. */
export function PageHero({
  kicker,
  title,
  lead,
  image,
  imagePos,
}: {
  kicker: string;
  title: string;
  lead: string;
  /** Photo de fond en filigrane (chemin public, ex. "/images/…jpg"). */
  image?: string;
  /** background-position de la photo. Défaut "center 30%". */
  imagePos?: string;
}) {
  return (
    <section className="page-hero">
      {image && (
        <div
          className="page-hero-img"
          style={{
            backgroundImage: `url(${image})`,
            ...(imagePos ? { backgroundPosition: imagePos } : null),
          }}
          aria-hidden="true"
        />
      )}
      <div className="wrap">
        <div className="sec-head">
          <div className="kicker">{kicker}</div>
          <h1 className="sec-title">{title}</h1>
          <p className="lead">{lead}</p>
        </div>
      </div>
    </section>
  );
}

/* ---------------- VALUES ---------------- */
/* Icônes des engagements (clés string du contenu CMS). */
const VALUE_ICONS = { CheckCircle, Grid, ShieldCheck, Lock, Clock } as const;

export function Values({
  as = "h2",
  tone,
  content,
}: PillarProps & { content: SectionContentOf<"values"> }) {
  const H = as;
  return (
    <section className={`${s.values} ${toneClass(tone)}`}>
      <div className="wrap">
        <div className="sec-head">
          <div className="kicker">{content.kicker}</div>
          <H className="sec-title">{content.title}</H>
        </div>
        <div className={s.valuesGrid}>
          {content.items.map(({ icon, title, text }) => {
            const Icon = VALUE_ICONS[icon as keyof typeof VALUE_ICONS];
            return (
              <div className={s.value} key={title} data-rv-value>
                <div className={s.vico}>
                  <Icon width={34} height={34} />
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            );
          })}
        </div>
        <LearnMore href={content.teaserHref} />
      </div>
    </section>
  );
}
