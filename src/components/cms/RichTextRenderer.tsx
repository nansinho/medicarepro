import { Fragment, type ReactNode } from "react";
import Link from "next/link";

/**
 * Rendu serveur d'un document Tiptap JSON. ALLOWLIST stricte par
 * VARIANT — tout nœud/marque hors liste est ignoré :
 * - "legal" (défaut, pages légales — NE PAS élargir) : h2, paragraph,
 *   bulletList/listItem ; marques bold et link.
 * - "blog" (articles) : + h3, orderedList, blockquote, image ;
 *   + marque italic.
 * Balises nues stylées par article.module.css. Pas de
 * dangerouslySetInnerHTML : React échappe tout le texte.
 * L'éditeur (RichTextEditor) est le miroir exact de ces allowlists.
 */

type TiptapMark = { type: string; attrs?: Record<string, unknown> };
type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  marks?: TiptapMark[];
  content?: TiptapNode[];
  text?: string;
};

export type RichTextBody = { type: "doc"; content: TiptapNode[] };
export type RichTextVariant = "legal" | "blog";

const FEATURES: Record<
  RichTextVariant,
  { headings: number[]; italic: boolean; ordered: boolean; quote: boolean; image: boolean }
> = {
  legal: { headings: [2], italic: false, ordered: false, quote: false, image: false },
  blog: { headings: [2, 3], italic: true, ordered: true, quote: true, image: true },
};

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** Nœud texte : applique les marques autorisées. */
function renderText(node: TiptapNode, key: number, variant: RichTextVariant): ReactNode {
  let out: ReactNode = node.text ?? "";
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") {
      out = <strong>{out}</strong>;
    } else if (mark.type === "italic" && FEATURES[variant].italic) {
      out = <em>{out}</em>;
    } else if (mark.type === "link") {
      const href = str(mark.attrs?.href);
      if (!href) continue;
      out = href.startsWith("/") ? (
        /* Lien interne → navigation client (même rendu <a href>). */
        <Link href={href}>{out}</Link>
      ) : (
        <a href={href} target={str(mark.attrs?.target)} rel={str(mark.attrs?.rel)}>
          {out}
        </a>
      );
    }
    /* Autres marques : hors allowlist, ignorées. */
  }
  return <Fragment key={key}>{out}</Fragment>;
}

/** Contenu en ligne d'un bloc : nœuds texte uniquement. */
function renderInline(
  nodes: TiptapNode[] | undefined,
  variant: RichTextVariant,
): ReactNode {
  return (nodes ?? []).map((node, i) =>
    node.type === "text" ? renderText(node, i, variant) : null,
  );
}

function renderListItems(
  nodes: TiptapNode[] | undefined,
  variant: RichTextVariant,
): ReactNode {
  return (nodes ?? []).map((item, i) =>
    item.type === "listItem" ? (
      <li key={i}>
        {(item.content ?? [])
          .filter((child) => child.type === "paragraph")
          .map((child, j) => (
            <Fragment key={j}>{renderInline(child.content, variant)}</Fragment>
          ))}
      </li>
    ) : null,
  );
}

/** Bloc de premier niveau du document. */
function renderBlock(
  node: TiptapNode,
  key: number,
  variant: RichTextVariant,
): ReactNode {
  const features = FEATURES[variant];
  switch (node.type) {
    case "heading": {
      const level = node.attrs?.level;
      if (typeof level !== "number" || !features.headings.includes(level)) {
        return null;
      }
      const Tag = level === 3 ? "h3" : "h2";
      return <Tag key={key}>{renderInline(node.content, variant)}</Tag>;
    }
    case "paragraph":
      return <p key={key}>{renderInline(node.content, variant)}</p>;
    case "bulletList":
      return <ul key={key}>{renderListItems(node.content, variant)}</ul>;
    case "orderedList":
      if (!features.ordered) return null;
      return <ol key={key}>{renderListItems(node.content, variant)}</ol>;
    case "blockquote":
      if (!features.quote) return null;
      return (
        <blockquote key={key}>
          {(node.content ?? [])
            .filter((child) => child.type === "paragraph")
            .map((child, i) => (
              <p key={i}>{renderInline(child.content, variant)}</p>
            ))}
        </blockquote>
      );
    case "image": {
      if (!features.image) return null;
      const src = str(node.attrs?.src);
      if (!src) return null;
      return (
        // eslint-disable-next-line @next/next/no-img-element -- dimensions inconnues (contenu libre), URL publique du CMS
        <img
          key={key}
          src={src}
          alt={str(node.attrs?.alt) ?? ""}
          title={str(node.attrs?.title)}
          loading="lazy"
        />
      );
    }
    default:
      return null; /* hors allowlist */
  }
}

export default function RichTextRenderer({
  body,
  variant = "legal",
}: {
  body: RichTextBody;
  variant?: RichTextVariant;
}) {
  return <>{(body.content ?? []).map((node, i) => renderBlock(node, i, variant))}</>;
}
