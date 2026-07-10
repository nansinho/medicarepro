import { Fragment, type ReactNode } from "react";
import Link from "next/link";

/**
 * Rendu serveur du corps riche des pages légales (document Tiptap JSON,
 * sections `rich_text`). ALLOWLIST stricte — tout nœud/marque hors liste est
 * ignoré :
 * - blocs : heading (niveau 2 uniquement), paragraph, bulletList/listItem ;
 * - texte : marques bold et link (href + target/rel optionnels).
 * Produit exactement le HTML des anciens JSX légaux (balises nues stylées par
 * article.module.css : h2, p, ul, li, strong, a). Pas de
 * dangerouslySetInnerHTML : React échappe tout le texte.
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

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** Nœud texte : applique les marques autorisées (bold, link). */
function renderText(node: TiptapNode, key: number): ReactNode {
  let out: ReactNode = node.text ?? "";
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") {
      out = <strong>{out}</strong>;
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
function renderInline(nodes: TiptapNode[] | undefined): ReactNode {
  return (nodes ?? []).map((node, i) =>
    node.type === "text" ? renderText(node, i) : null,
  );
}

/** Bloc de premier niveau du document. */
function renderBlock(node: TiptapNode, key: number): ReactNode {
  switch (node.type) {
    case "heading":
      /* Seul le niveau 2 est autorisé (structure des pages légales). */
      if (node.attrs?.level !== 2) return null;
      return <h2 key={key}>{renderInline(node.content)}</h2>;
    case "paragraph":
      return <p key={key}>{renderInline(node.content)}</p>;
    case "bulletList":
      return (
        <ul key={key}>
          {(node.content ?? []).map((item, i) =>
            item.type === "listItem" ? (
              <li key={i}>
                {(item.content ?? [])
                  .filter((child) => child.type === "paragraph")
                  .map((child, j) => (
                    <Fragment key={j}>{renderInline(child.content)}</Fragment>
                  ))}
              </li>
            ) : null,
          )}
        </ul>
      );
    default:
      return null; /* hors allowlist */
  }
}

export default function RichTextRenderer({ body }: { body: RichTextBody }) {
  return <>{(body.content ?? []).map(renderBlock)}</>;
}
