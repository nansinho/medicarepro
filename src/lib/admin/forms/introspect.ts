import {
  ZodAny,
  ZodArray,
  ZodBoolean,
  ZodDefault,
  ZodEnum,
  ZodLiteral,
  ZodNullable,
  ZodNumber,
  ZodObject,
  ZodOptional,
  ZodString,
  type ZodType,
} from "zod";
import {
  SECTION_SCHEMAS,
  ImageRefSchema,
  LinkRefSchema,
  IconKeySchema,
  ToneSchema,
  ToneWithDarkSchema,
  MockupKindSchema,
  type SectionType,
} from "@/lib/cms/sections.schema";

/* ============================================================
   Introspection des schémas de sections → arbre de formulaire.
   Les PRIMITIVES PARTAGÉES sont reconnues par IDENTITÉ DE
   RÉFÉRENCE (unwrapped === ImageRefSchema…) : sections.schema.ts
   doit continuer à réutiliser ces constantes exportées (ne pas
   inliner un z.object équivalent). Tout nœud non reconnu devient
   kind:"unknown" (éditeur JSON brut) — aucun type ne casse.
   ============================================================ */

export type FieldNode =
  | { kind: "string"; path: string; optional: boolean }
  | { kind: "number"; path: string; optional: boolean }
  | { kind: "boolean"; path: string; optional: boolean }
  | { kind: "enum"; path: string; values: string[]; optional: boolean }
  | {
      kind: "imageRef" | "linkRef" | "iconKey" | "tone" | "toneDark" | "mockup";
      path: string;
      optional: boolean;
    }
  | { kind: "richBody"; path: string }
  | { kind: "object"; path: string; fields: FieldNode[]; optional: boolean }
  | {
      kind: "array";
      path: string;
      item: FieldNode;
      optional: boolean;
    }
  | { kind: "unknown"; path: string };

/** Déballe optional/nullable/default pour atteindre le schéma porteur. */
function unwrap(schema: ZodType): { inner: ZodType; optional: boolean } {
  let current: ZodType = schema;
  let optional = false;
  for (let i = 0; i < 6; i++) {
    if (current instanceof ZodOptional || current instanceof ZodNullable) {
      optional = true;
      current = current.unwrap() as ZodType;
    } else if (current instanceof ZodDefault) {
      current = (
        current as unknown as { unwrap: () => ZodType }
      ).unwrap();
    } else {
      break;
    }
  }
  return { inner: current, optional };
}

/** Document Tiptap du type rich_text : { type: "doc", content: any[] }. */
function isRichBodySchema(schema: ZodType): boolean {
  if (!(schema instanceof ZodObject)) return false;
  const shape = schema.shape as Record<string, ZodType>;
  const keys = Object.keys(shape);
  return (
    keys.length === 2 &&
    shape.type instanceof ZodLiteral &&
    shape.content instanceof ZodArray
  );
}

function walk(schema: ZodType, path: string): FieldNode {
  const { inner, optional } = unwrap(schema);

  /* Primitives partagées — identité de référence. */
  if (inner === ImageRefSchema) return { kind: "imageRef", path, optional };
  if (inner === LinkRefSchema) return { kind: "linkRef", path, optional };
  if (inner === IconKeySchema) return { kind: "iconKey", path, optional };
  if (inner === ToneSchema) return { kind: "tone", path, optional };
  if (inner === ToneWithDarkSchema) return { kind: "toneDark", path, optional };
  if (inner === MockupKindSchema) return { kind: "mockup", path, optional };

  if (isRichBodySchema(inner)) return { kind: "richBody", path };

  if (inner instanceof ZodString) return { kind: "string", path, optional };
  if (inner instanceof ZodNumber) return { kind: "number", path, optional };
  if (inner instanceof ZodBoolean) return { kind: "boolean", path, optional };
  if (inner instanceof ZodEnum) {
    return {
      kind: "enum",
      path,
      values: (inner as ZodEnum<Record<string, string>>).options as string[],
      optional,
    };
  }
  if (inner instanceof ZodArray) {
    return {
      kind: "array",
      path,
      item: walk(inner.element as ZodType, ""),
      optional,
    };
  }
  if (inner instanceof ZodObject) {
    const shape = inner.shape as Record<string, ZodType>;
    return {
      kind: "object",
      path,
      optional,
      fields: Object.entries(shape).map(([key, child]) =>
        walk(child, path ? `${path}.${key}` : key),
      ),
    };
  }
  if (inner instanceof ZodLiteral || inner instanceof ZodAny) {
    return { kind: "unknown", path };
  }
  return { kind: "unknown", path };
}

/** Arbre de formulaire de n'importe quel z.object (collections, etc.). */
export function buildTreeFromSchema(
  schema: ZodObject,
  hiddenKeys: readonly string[] = [],
): FieldNode[] {
  const shape = schema.shape as Record<string, ZodType>;
  return Object.entries(shape)
    .filter(([key]) => !hiddenKeys.includes(key))
    .map(([key, child]) => walk(child, key));
}

const cache = new Map<SectionType, FieldNode[]>();

/** Arbre de formulaire d'un type de section (mémoïsé). */
export function buildFormTree(type: SectionType): FieldNode[] {
  const cached = cache.get(type);
  if (cached) return cached;
  const tree = buildTreeFromSchema(
    SECTION_SCHEMAS[type] as unknown as ZodObject,
    ["type", "_v"],
  );
  cache.set(type, tree);
  return tree;
}

/** Valeur par défaut d'un nœud (nouvel élément de tableau, etc.). */
export function defaultValue(node: FieldNode): unknown {
  switch (node.kind) {
    case "string":
      return "";
    case "number":
      return 0;
    case "boolean":
      return false;
    case "enum":
      return node.values[0] ?? "";
    case "iconKey":
      return IconKeySchema.options[0];
    case "tone":
      return "white";
    case "toneDark":
      return "white";
    case "mockup":
      return MockupKindSchema.options[0];
    case "imageRef":
      return { mediaId: null, path: "", alt: "" };
    case "linkRef":
      return { label: "", href: "" };
    case "richBody":
      return { type: "doc", content: [] };
    case "array":
      return [];
    case "object": {
      const out: Record<string, unknown> = {};
      for (const field of node.fields) {
        const key = field.path.split(".").pop() ?? field.path;
        out[key] = defaultValue(field);
      }
      return out;
    }
    default:
      return null;
  }
}
