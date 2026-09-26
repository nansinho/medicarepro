import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ArrowRight, ChevronRight, Quote } from "@/components/icons";
import type { BlogPost } from "@/data/blogPosts";
import type {
  CountStat,
  FaqItem,
  Testimonial,
  IconKey,
  LinkRef,
  SectionContentOf,
  Step,
  TrustChip,
} from "@/lib/cms/sections.schema";
import { Btn, Head, Paras, Split, fr, rich } from "./Kit";
import { Icon } from "./icon";
import { ACCENTS, ACCENT_BY_MOCKUP, CYCLE } from "./palette";
import { CornerMark } from "./Symbols";
import { Devices, PhotoFrame, type Highlight } from "./Visuals";
import type { ScreenKind } from "./screens/AppScreen";
import b from "./blocks.module.css";

/* ============================================================
   Blocs de contenu, alimentés par les sections du CMS.
   Les pages choisissent le fond (Section) ; ces blocs posent
   le contenu dedans.
   ============================================================ */

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

/* ---------- Essentiels ---------- */

export function EssentialsBlock({ content }: { content: SectionContentOf<"essentials"> }) {
  const hl = content.highlight;
  return (
    <>
      <Head eyebrow={content.kicker} title={content.title} centered />
      <div className={b.wide} data-rv-kit="">
        <CornerMark className={b.corner} />
        <div>
          <span className={b.label} style={{ "--c": "var(--brand-amber-ink)" } as CSSProperties}>
            {hl.label}
          </span>
          <h3>{rich(hl.title)}</h3>
          <p>{rich(hl.text)}</p>
        </div>
        <div>
          {hl.note && <p className={b.wideNote}>{hl.note}</p>}
          <Btn href={hl.cta.href} size="sm">
            {hl.cta.label}
          </Btn>
        </div>
      </div>
      <div className={b.cards4}>
        {content.cards.map((card) => (
          <div key={card.label} className={b.card} data-rv-kit="">
            <span className={b.label} style={{ "--c": ACCENTS[card.accent].c } as CSSProperties}>
              {card.label}
            </span>
            <h3>{rich(card.title)}</h3>
            <p>{rich(card.text)}</p>
            <Btn href={card.cta.href} size="sm" className={b.cardBtn}>
              {card.cta.label}
            </Btn>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------- Offre ---------- */

export function OfferBlock({ content }: { content: SectionContentOf<"offer_band"> }) {
  return (
    <div className={b.offer} data-rv-kit="">
      <CornerMark className={b.corner2} />
      <div>
        <h2>{content.title}</h2>
        <p className={b.offerBig}>{rich(content.headline)}</p>
        {content.compare && <p className={b.offerSmall}>{fr(content.compare)}</p>}
        <Btn href={content.cta.href} variant="amber" size="lg">
          {content.cta.label}
        </Btn>
        {content.fine && <p className={b.offerFine}>{fr(content.fine)}</p>}
      </div>
    </div>
  );
}

/* ---------- FAQ (accordéon natif, sans script) ---------- */

export function FaqBlock({
  kicker,
  title,
  items,
  id,
}: {
  kicker?: string;
  title?: string;
  items: FaqItem[];
  id?: string;
}) {
  return (
    <>
      <Head eyebrow={kicker} title={title || "Questions fréquentes"} id={id} centered />
      <div className={b.faq}>
        {items.map((item, i) => (
          <details key={item.q} open={i === 0}>
            <summary>{fr(item.q)}</summary>
            <p>{fr(item.a)}</p>
          </details>
        ))}
      </div>
    </>
  );
}

/** Données structurées FAQPage (résultats enrichis). */
export function FaqJsonLd({ items }: { items: FaqItem[] }) {
  if (items.length === 0) return null;
  const json = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />;
}

/* ---------- Articles ---------- */

export function PostCards({ posts, headingLevel = "h3" }: { posts: BlogPost[]; headingLevel?: "h2" | "h3" }) {
  const H = headingLevel;
  return (
    <div className={b.posts}>
      {posts.map((post, i) => (
        <Link key={post.slug} href={`/blog/${post.slug}`} className={b.post} data-rv-post="">
          <Image
            src={post.image}
            alt={post.imageAlt}
            fill
            sizes="(max-width: 960px) 92vw, 30vw"
            priority={i === 0 && headingLevel === "h2"}
          />
          <div className={b.postBody}>
            <small>{post.dateDisplay}</small>
            <H>{post.title}</H>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function BlogTeaserBlock({
  content,
  posts,
}: {
  content: SectionContentOf<"blog_teaser">;
  posts: BlogPost[];
}) {
  const list = posts.slice(0, content.limit ?? 3);
  if (list.length === 0) return null;
  return (
    <>
      <Head eyebrow={content.kicker} title={content.title} centered />
      <PostCards posts={list} />
      <div className={b.postsMore}>
        <Btn href="/blog" variant="outline" size="lg">
          Tous les articles
        </Btn>
      </div>
    </>
  );
}

/* ---------- Chiffres ---------- */

const NUM = (decimals = 0) =>
  new Intl.NumberFormat("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export function formatStat(s: Pick<CountStat, "to" | "prefix" | "suffix" | "decimals">) {
  const decimals = s.decimals ?? (Number.isInteger(s.to) ? 0 : String(s.to).split(".")[1]?.length ?? 0);
  return `${s.prefix ?? ""}${NUM(decimals).format(s.to)}${s.suffix ?? ""}`;
}

export function StatsBlock({ stats, onWhite }: { stats: CountStat[]; onWhite?: boolean }) {
  return (
    <div className={cx(b.stats, onWhite && b.statsWhite)}>
      {stats.map((s, i) => (
        <div
          key={s.label}
          className={b.statCard}
          data-rv-kit=""
          style={{ "--c": ACCENTS[CYCLE[i % CYCLE.length]].c } as CSSProperties}
        >
          <b>{formatStat(s)}</b>
          <span>{fr(s.label)}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Cartes à icône ---------- */

export type IconCard = {
  icon: IconKey | string;
  title: string;
  text: string;
  href?: string;
  linkLabel?: string;
  stat?: string;
};

export function IconCards({
  items,
  cols = 3,
  onWhite,
}: {
  items: IconCard[];
  cols?: 2 | 3 | 4;
  /** Section blanche : les cartes prennent un liseré. */
  onWhite?: boolean;
}) {
  const grid = cols === 4 ? b.cards4 : cols === 2 ? b.cards2 : b.cards3;
  return (
    <div className={cx(grid, onWhite && b.onWhite)}>
      {items.map((item, i) => {
        const a = ACCENTS[CYCLE[i % CYCLE.length]];
        const style = { "--c": a.c, "--t": a.t } as CSSProperties;
        const inner = (
          <>
            {item.stat && <span className={b.stat}>{item.stat}</span>}
            <span className={b.ico}>
              <Icon name={item.icon} />
            </span>
            <h3>{rich(item.title)}</h3>
            <p>{rich(item.text)}</p>
            {item.href && (
              <span className={b.cardLink}>
                {item.linkLabel ?? "En savoir plus"}
                <ArrowRight aria-hidden="true" />
              </span>
            )}
          </>
        );
        return item.href ? (
          <Link key={item.title} href={item.href} className={b.card} style={style} data-rv-kit="">
            {inner}
          </Link>
        ) : (
          <div key={item.title} className={b.card} style={style} data-rv-kit="">
            {inner}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Étapes ---------- */

export function StepsBlock({ steps, onWhite }: { steps: Step[]; onWhite?: boolean }) {
  return (
    <div
      className={cx(b.steps, onWhite && b.stepsWhite)}
      style={{ "--n": Math.min(steps.length, 4) } as CSSProperties}
    >
      {steps.map((step, i) => (
        <div
          key={step.title}
          className={b.step}
          data-rv-kit=""
          style={{ "--c": ACCENTS[CYCLE[i % CYCLE.length]].c } as CSSProperties}
        >
          <h3>{step.title}</h3>
          <p>{rich(step.text)}</p>
        </div>
      ))}
    </div>
  );
}

/* ---------- Liens croisés ---------- */

export function LinksRow({ links }: { links: LinkRef[] }) {
  if (links.length === 0) return null;
  return (
    <nav className={b.links} aria-label="Pour aller plus loin">
      {links.map((l) => (
        <Link key={l.href + l.label} href={l.href}>
          {l.label}
          <ChevronRight aria-hidden="true" />
        </Link>
      ))}
    </nav>
  );
}

/* ---------- Appel à l'action de fin de page ---------- */

export function CtaBlock({
  kicker,
  title,
  lead,
  primary,
  secondary,
  trust,
}: {
  kicker?: string;
  title: string;
  lead?: string;
  primary: LinkRef;
  secondary?: LinkRef;
  trust?: TrustChip[];
}) {
  return (
    <div className={b.cta} data-rv-kit="">
      <span className={b.ctaShape1} aria-hidden="true" />
      <span className={b.ctaShape2} aria-hidden="true" />
      <div>
        {kicker && <span className={b.ctaKicker}>{kicker}</span>}
        <h2>{rich(title)}</h2>
        {lead && <Paras text={lead} />}
        {trust && trust.length > 0 && (
          <div className={b.ctaTrust}>
            {trust.map((t) => (
              <span key={t.label}>
                <Icon name={t.icon} />
                {t.label}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className={b.ctaActions}>
        <Btn href={primary.href} size="lg">
          {primary.label}
        </Btn>
        {secondary && (
          <Btn href={secondary.href} variant="outline" size="lg">
            {secondary.label}
          </Btn>
        )}
      </div>
    </div>
  );
}

/* ---------- Section « showcase » en deux colonnes ---------- */

type ShowcaseLike = {
  kicker?: string;
  title: string;
  text?: string;
  points?: string[];
  mockup?: SectionContentOf<"showcase">["mockup"];
  image?: { path: string; alt: string };
  reverse?: boolean;
  cta?: LinkRef;
};

/**
 * Deux colonnes texte + visuel à partir d'une section du CMS : photo posée
 * sur une forme si la section a une image, sinon l'écran du logiciel dans
 * l'ordinateur. `variant` fait tourner les formes d'une section à l'autre.
 */
export function ShowcaseSplit({
  content,
  variant = 0,
  reverse,
  phone = false,
  highlight,
  after,
  visualAfter,
  screen,
  color: forced,
}: {
  content: ShowcaseLike;
  variant?: number;
  reverse?: boolean;
  phone?: boolean;
  highlight?: Highlight | null;
  after?: ReactNode;
  visualAfter?: ReactNode;
  /** Force l'écran affiché (sinon celui du mockup). */
  screen?: ScreenKind;
  /** Couleur de module (sur-titre, étoiles) quand la section n'a pas d'écran. */
  color?: string;
}) {
  const kind = screen ?? content.mockup;
  const color = forced ?? (content.mockup ? ACCENTS[ACCENT_BY_MOCKUP[content.mockup]].c : undefined);
  const visual = content.image?.path ? (
    <PhotoFrame src={content.image.path} alt={content.image.alt} variant={variant} />
  ) : kind ? (
    <Devices screen={kind} variant={variant} phone={phone} highlight={highlight} />
  ) : null;
  return (
    <Split
      visual={visual}
      reverse={reverse ?? content.reverse}
      eyebrow={content.kicker || undefined}
      eyebrowColor={color}
      title={content.title}
      text={content.text || undefined}
      items={content.points}
      starColor={color}
      cta={content.cta ?? null}
      after={after}
      visualAfter={visualAfter}
    />
  );
}

/* ---------- Avis (collection testimonials) ---------- */

/**
 * Avis réels de podologues. Tant qu'il n'y en a aucun, un encart honnête
 * « Bientôt, les premiers avis » : jamais de témoignage inventé.
 */
export function ReviewsBlock({ people }: { people: Testimonial[] }) {
  if (people.length === 0) {
    return (
      <div className={b.soon} data-rv-kit="">
        <span className={b.soonIco} aria-hidden="true">
          <Quote />
        </span>
        <h3>Bientôt, les premiers avis</h3>
        <p>
          MediCare Pro accueille ses premiers cabinets. Les avis de nos podologues utilisateurs
          seront publiés ici très prochainement.
        </p>
      </div>
    );
  }
  return (
    <div className={b.quotes}>
      {people.map((p) => (
        <figure key={p.name} className={b.quote} data-rv-kit="">
          <blockquote>
            <p>{fr(p.quote)}</p>
          </blockquote>
          <figcaption className={b.quoteWho}>
            <Image src={p.avatar.path} alt="" width={48} height={48} />
            <span>
              <b>{p.name}</b>
              <small>{p.role}</small>
            </span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

/* ---------- Frise verticale ---------- */

export function TimelineList({ steps, ring }: { steps: Step[]; ring?: string }) {
  return (
    <ol className={b.tl} style={ring ? ({ "--ring": ring } as CSSProperties) : undefined}>
      {steps.map((step, i) => (
        <li
          key={step.title}
          data-rv-kit=""
          style={{ "--c": ACCENTS[CYCLE[i % CYCLE.length]].c } as CSSProperties}
        >
          <div className={b.tlCard}>
            <h3>{step.title}</h3>
            <p>{rich(step.text)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Signature({ children }: { children: string }) {
  return <p className={b.sign}>{children}</p>;
}
