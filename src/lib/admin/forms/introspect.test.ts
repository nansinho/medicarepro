import { describe, expect, it } from "vitest";
import { SECTION_SCHEMAS, type SectionType } from "@/lib/cms/sections.schema";
import { buildFormTree, defaultValue, type FieldNode } from "./introspect";

/* Garde-fou du SectionFormRenderer : chaque type de section doit
   s'introspecter SANS nœud "unknown" (hors champs volontairement
   avancés). Si ce test casse après une évolution de schéma, c'est
   qu'une primitive partagée a été inlinée au lieu d'être réutilisée
   (détection par identité de référence) ou qu'un nouveau genre de
   champ nécessite un widget. */

const TYPES = Object.keys(SECTION_SCHEMAS) as SectionType[];

/** Chemins tolérés en JSON brut (structures volontairement libres). */
const ALLOWED_UNKNOWN = new Set<string>([
  /* savings_compare : stats polymorphes (union) — éditées en JSON. */
]);

function collectUnknown(nodes: FieldNode[], acc: string[]): string[] {
  for (const node of nodes) {
    if (node.kind === "unknown" && !ALLOWED_UNKNOWN.has(node.path)) {
      acc.push(node.path);
    }
    if (node.kind === "object") collectUnknown(node.fields, acc);
    if (node.kind === "array") collectUnknown([node.item], acc);
  }
  return acc;
}

describe("introspection des sections", () => {
  it.each(TYPES)("le type %s s'introspecte sans nœud inconnu", (type) => {
    const tree = buildFormTree(type);
    expect(tree.length).toBeGreaterThan(0);
    expect(collectUnknown(tree, [])).toEqual([]);
  });

  it.each(TYPES)("defaultValue produit une valeur pour chaque nœud de %s", (type) => {
    for (const node of buildFormTree(type)) {
      expect(defaultValue(node)).not.toBe(undefined);
    }
  });
});
