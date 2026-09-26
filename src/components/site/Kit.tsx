import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ChevronRight } from "@/components/icons";
import { emphasize, lines } from "@/components/cms/inline";
import { resolveHref } from "@/lib/appLinks";
import { Icon } from "./icon";
import { ACCENTS, CYCLE } from "./palette";
import { StarMark } from "./Symbols";
import { EdgeShapes } from "./Visuals";
import k from "./kit.module.css";

/* ============================================================
   Briques de la vitrine (refonte 2026). Composants serveur,
   sans état : la mise en page vient des pages, le contenu du CMS.
   ============================================================ */

export type Tint = "white" | "teal" | "blue" | "violet" | "amber" | "sky";

const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

/** `**…**` → <b>, `\n` → <br />. Aucun HTML interprété. */
export function rich(text: string): ReactNode {
  return lines(fr(text), { accent: (seg, key) => <b key={key}>{seg}</b> });
}

/** Typographie française : espace insécable avant « : ; ? ! % € » et après
 *  « « », espace fine entre les milliers. Évite « 100 / % » en fin de ligne. */
export function fr(text: string): string {
  return text
    .replace(/ ([%€:;?!»])/g, " $1")
    .replace(/« /g, "« ")
    .replace(/(\d) (\d{3})(?!\d)/g, "$1 $2");
}

/** Paragraphe(s) : une ligne vide (`\n\n`) sépare deux paragraphes. */
export function Paras({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/\n{2,}/)
        .filter((p) => p.trim())
        .map((p, i) => (
          <p key={i}>{rich(p)}</p>
        ))}
    </>
  );
}

/* ---------- Section ---------- */

export function Section({
  tint = "white",
  edge,
  center,
  hero,
  tight,
  id,
  labelledBy,
  className,
  children,
}: {
  tint?: Tint;
  /** Formes coupées au bord de la section (variante 0 à 5). */
  edge?: number;
  center?: boolean;
  hero?: boolean;
  tight?: boolean;
  id?: string;
  labelledBy?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      data-hero={hero ? "" : undefined}
      className={cx(
        k.sec,
        k[`t_${tint}`],
        center && k.center,
        hero && k.hero,
        tight && k.tight,
        className,
      )}
    >
      {edge !== undefined && <EdgeShapes variant={edge} />}
      <div className={k.w}>{children}</div>
    </section>
  );
}

/** Conteneur seul (pour les blocs hors <Section>). */
export function Wrap({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx(k.w, className)}>{children}</div>;
}

/* ---------- Titres ---------- */

export function Eyebrow({
  children,
  color,
}: {
  children: ReactNode;
  /** Couleur de module : sur-titre coloré au lieu du gris. */
  color?: string;
}) {
  if (color) {
    return (
      <span className={k.eyc} style={{ "--c": color } as CSSProperties}>
        {children}
      </span>
    );
  }
  return <span className={k.eyb}>{children}</span>;
}

/** Tête de section : sur-titre, titre (h2 par défaut), texte d'introduction. */
export function Head({
  eyebrow,
  title,
  lead,
  as = "h2",
  id,
  centered,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  as?: "h1" | "h2";
  id?: string;
  centered?: boolean;
}) {
  const H = as;
  return (
    <div className={cx(k.head, centered && k.centered)} data-rv-kit="">
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <H id={id} className={as === "h1" ? k.h1 : k.h2}>
        {rich(title)}
      </H>
      {lead && (
        <div className={k.text}>
          <Paras text={lead} />
        </div>
      )}
    </div>
  );
}

export function Title({
  as = "h2",
  id,
  children,
}: {
  as?: "h1" | "h2" | "h3";
  id?: string;
  children: string;
}) {
  const H = as;
  const cls = as === "h1" ? k.h1 : as === "h2" ? k.h2 : k.h3;
  return (
    <H id={id} className={cls}>
      {rich(children)}
    </H>
  );
}

export function Sub({ children }: { children: string }) {
  return <p className={k.sub}>{rich(children)}</p>;
}

export function Text({ children }: { children: string }) {
  return (
    <div className={k.text}>
      <Paras text={children} />
    </div>
  );
}

/* ---------- Boutons ---------- */

export type BtnVariant = "primary" | "outline" | "amber" | "white";

export function Btn({
  href,
  children,
  variant = "primary",
  size = "md",
  className,
  icon,
  download,
}: {
  href: string;
  children: ReactNode;
  variant?: BtnVariant;
  size?: "lg" | "md" | "sm";
  className?: string;
  icon?: ReactNode;
  /** Fichier à télécharger (ZIP, PDF…) : lien simple, pas de navigation. */
  download?: boolean;
}) {
  const url = resolveHref(href);
  const cls = cx(
    k.btn,
    k[variant],
    size === "lg" && k.lg,
    size === "sm" && k.sm,
    className,
  );
  const body = (
    <>
      {children}
      {icon}
    </>
  );
  if (download) {
    return (
      <a href={url} className={cls} download>
        {body}
      </a>
    );
  }
  if (/^(https?:|mailto:|tel:)/.test(url)) {
    const external = url.startsWith("http");
    return (
      <a
        href={url}
        className={cls}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {body}
      </a>
    );
  }
  return (
    <Link href={url} className={cls}>
      {body}
    </Link>
  );
}

/** Rangée de boutons (le premier plein, les suivants en contour). */
export function BtnRow({
  links,
  size = "lg",
}: {
  links: { label: string; href: string; variant?: BtnVariant }[];
  size?: "lg" | "md";
}) {
  if (links.length === 0) return null;
  return (
    <div className={k.row}>
      {links.map((l, i) => (
        <Btn
          key={l.href + l.label}
          href={l.href}
          size={size}
          variant={l.variant ?? (i === 0 ? "primary" : "outline")}
        >
          {l.label}
        </Btn>
      ))}
    </div>
  );
}

/* ---------- Liste à l'étoile du logo ---------- */

export function StarList({
  items,
  color,
}: {
  items: string[];
  /** Couleur de l'étoile (défaut : violet du logo). */
  color?: string;
}) {
  return (
    <ul
      className={k.list}
      data-anim="list"
      style={color ? ({ "--c": color } as CSSProperties) : undefined}
    >
      {items.map((item) => (
        <li key={item}>
          <StarMark />
          <span>{emphasize(fr(item), (seg, key) => <b key={key}>{seg}</b>)}</span>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Deux colonnes : texte + visuel ---------- */

export function Split({
  visual,
  reverse,
  eyebrow,
  eyebrowColor,
  title,
  titleAs = "h2",
  text,
  items,
  starColor,
  cta,
  after,
  visualAfter,
}: {
  visual: ReactNode;
  reverse?: boolean;
  eyebrow?: string;
  eyebrowColor?: string;
  title: string;
  titleAs?: "h1" | "h2";
  text?: string;
  items?: string[];
  starColor?: string;
  cta?: { label: string; href: string } | null;
  after?: ReactNode;
  /** Sous le visuel (pastilles de conformité…). */
  visualAfter?: ReactNode;
}) {
  return (
    <div className={cx(k.two, reverse && k.rev)}>
      <div className={k.vis} data-rv-kit="">
        {visual}
        {visualAfter}
      </div>
      <div data-rv-kit="">
        {eyebrow && <Eyebrow color={eyebrowColor}>{eyebrow}</Eyebrow>}
        <Title as={titleAs}>{title}</Title>
        {text && (
          <div className={k.text} style={{ marginTop: 16 }}>
            <Paras text={text} />
          </div>
        )}
        {items && items.length > 0 && <StarList items={items} color={starColor} />}
        {cta && (
          <div className={k.row}>
            <Btn href={cta.href} size="lg">
              {cta.label}
            </Btn>
          </div>
        )}
        {after}
      </div>
    </div>
  );
}

/** Grille deux colonnes du hero (colonne visuelle un peu plus large). */
export function HeroGrid({
  children,
  visual,
}: {
  children: ReactNode;
  visual: ReactNode;
}) {
  return (
    <div className={cx(k.two, k.heroTwo)}>
      <div data-hero-text="">{children}</div>
      <div className={k.vis}>{visual}</div>
    </div>
  );
}

/* ---------- Fil d'Ariane ---------- */

export function Crumb({
  items,
}: {
  /** Du plus général au plus précis ; le dernier est la page courante. */
  items: { label: string; href?: string }[];
}) {
  return (
    <nav className={k.crumb} aria-label="Fil d'Ariane">
      {items.map((it, i) => (
        <span key={it.label} style={{ display: "contents" }}>
          {i > 0 && <ChevronRight aria-hidden="true" />}
          {it.href && i < items.length - 1 ? (
            <Link href={it.href}>{it.label}</Link>
          ) : (
            <span aria-current="page">{it.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/** Données structurées du fil d'Ariane (BreadcrumbList). */
export function CrumbJsonLd({
  items,
}: {
  items: { label: string; href: string }[];
}) {
  const json = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.label,
      item: `https://medicarepro.fr${it.href}`,
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}

/* ---------- Ligne de preuves ---------- */

/** Preuves en grille régulière (deux par ligne, une seule quand la colonne
 *  est étroite) : chaque preuve garde son icône, dans une pastille aux
 *  couleurs du logo, sans retour à la ligne bancal ni point orphelin. */
export function TrustLine({ items }: { items: { icon: string; label: string }[] }) {
  if (items.length === 0) return null;
  return (
    <div className={k.trustBox}>
      <ul className={k.trust}>
        {items.map((item, i) => {
          const a = ACCENTS[CYCLE[i % CYCLE.length]];
          return (
            <li key={item.label} style={{ "--c": a.c, "--t": a.t } as CSSProperties}>
              <span className={k.ic}>
                <Icon name={item.icon} />
              </span>
              {/* Sans partie en gras, le libellé entier passe en encre :
                  une preuve tout en gris paraît éteinte. */}
              <span>
                {item.label.includes("**") ? (
                  emphasize(fr(item.label), (seg, key) => <b key={key}>{seg}</b>)
                ) : (
                  <b>{fr(item.label)}</b>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Pastilles de conformité (HDS, RGPD, eIDAS…). */
export function Badges({
  items,
}: {
  items: { label: string; color: string; icon: ReactNode }[];
}) {
  return (
    <div className={k.badges}>
      {items.map((b) => (
        <span key={b.label} style={{ "--c": b.color } as CSSProperties}>
          {b.icon}
          {b.label}
        </span>
      ))}
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className={k.note}>{children}</p>;
}

export { k as kitStyles };
