import { Fragment, type ReactNode } from "react";

/**
 * Rendu des conventions de texte du CMS (cf. src/lib/cms/sections.schema.ts) :
 * - `\n` dans un titre/lead = retour à la ligne explicite (<br />) ;
 * - `**…**` = segment accentué (span accent, <strong> ou <b> selon le
 *   contexte, fourni par l'appelant pour garder les classes exactes).
 * Aucun HTML n'est interprété : tout passe par des nœuds React (échappement
 * automatique).
 */

/** Rend un texte dont `**…**` délimite les segments accentués. */
export function emphasize(
  text: string,
  accent: (segment: string, key: number) => ReactNode,
): ReactNode {
  return text
    .split(/\*\*(.+?)\*\*/g)
    .map((segment, i) => (i % 2 === 1 ? accent(segment, i) : segment));
}

/** Rend un texte dont `\n` = retour à la ligne (br surchargeable). */
export function lines(
  text: string,
  opts?: {
    /** Rendu d'un segment `**…**` (sinon texte brut). */
    accent?: (segment: string, key: number) => ReactNode;
    /** Rendu du saut de ligne. Défaut : <br />. */
    br?: (key: number) => ReactNode;
  },
): ReactNode {
  const renderBr = opts?.br ?? ((key: number) => <br key={`br-${key}`} />);
  const accent = opts?.accent;
  return text.split("\n").map((line, i) => (
    <Fragment key={i}>
      {i > 0 && renderBr(i)}
      {/* Espace de repli : invisible quand le <br> est rendu (espace en début
          de ligne, ignorée), mais évite « mot.Mot » quand un CSS responsive
          masque le <br> (ex. .breakLg des heros). */}
      {i > 0 && " "}
      {accent ? emphasize(line, accent) : line}
    </Fragment>
  ));
}
