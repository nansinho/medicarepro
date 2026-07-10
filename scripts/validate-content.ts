/**
 * Validation des payloads de contenu contre le registre zod du CMS.
 *
 * Usage : npx tsx scripts/validate-content.ts
 *
 * - safeParse de CHAQUE section de CHAQUE page gérée via l'union discriminée
 *   (SectionContentSchema) + vérification type slot === content.type ;
 * - safeParse de chaque entrée des collections (testimonials, pricing_plans,
 *   pricing_examples, feature_items, faq_items) ;
 * - sort avec un code non nul en listant les échecs.
 */
import { z } from "zod";
import {
  SectionContentSchema,
  TestimonialSchema,
  PricingPlanSchema,
  PricingExampleSchema,
  FeatureItemSchema,
  FaqItemSchema,
  type ManagedPageContent,
} from "../src/lib/cms/sections.schema";

import { PAGE_HOME } from "../src/data/content/home";
import { PAGE_FONCTIONNALITES } from "../src/data/content/fonctionnalites";
import { PAGE_BILANS } from "../src/data/content/bilans";
import { PAGE_SECURITE } from "../src/data/content/securite";
import { PAGE_AVANTAGES } from "../src/data/content/avantages";
import { PAGE_TARIFS } from "../src/data/content/tarifs";
import { PAGE_CONTACT } from "../src/data/content/contact";
import { PAGE_A_PROPOS } from "../src/data/content/a-propos";
import {
  PAGE_CGU,
  PAGE_MENTIONS,
  PAGE_CONFIDENTIALITE,
} from "../src/data/content/legal";
import {
  TESTIMONIALS,
  PRICING_PLANS,
  PRICING_EXAMPLES,
  FEATURE_ITEMS,
  FAQ_ITEMS,
} from "../src/data/content/collections";

const PAGES: ManagedPageContent[] = [
  PAGE_HOME,
  PAGE_FONCTIONNALITES,
  PAGE_BILANS,
  PAGE_SECURITE,
  PAGE_AVANTAGES,
  PAGE_TARIFS,
  PAGE_CONTACT,
  PAGE_A_PROPOS,
  PAGE_CGU,
  PAGE_MENTIONS,
  PAGE_CONFIDENTIALITE,
];

let checked = 0;
const failures: string[] = [];

/* ---- Sections des pages gérées ---- */
for (const page of PAGES) {
  for (const section of page.sections) {
    checked += 1;
    const label = `${page.slug} · ${section.key} (${section.type})`;
    const result = SectionContentSchema.safeParse(section.content);
    if (!result.success) {
      failures.push(`${label}\n${z.prettifyError(result.error)}`);
      continue;
    }
    if (result.data.type !== section.type) {
      failures.push(
        `${label} : le type du slot ("${section.type}") ne correspond pas au type du payload ("${result.data.type}")`,
      );
    }
  }
}

/* ---- Collections ---- */
function validateCollection<T>(
  name: string,
  schema: z.ZodType<T>,
  rows: unknown[],
  keyOf: (row: unknown, index: number) => string,
) {
  rows.forEach((row, index) => {
    checked += 1;
    const result = schema.safeParse(row);
    if (!result.success) {
      failures.push(
        `collection ${name} · ${keyOf(row, index)}\n${z.prettifyError(result.error)}`,
      );
    }
  });
}

const nameOf = (row: unknown, index: number) =>
  typeof row === "object" && row !== null
    ? String(
        (row as Record<string, unknown>).name ??
          (row as Record<string, unknown>).title ??
          (row as Record<string, unknown>).config ??
          (row as Record<string, unknown>).q ??
          `#${index}`,
      )
    : `#${index}`;

validateCollection("testimonials", TestimonialSchema, TESTIMONIALS, nameOf);
validateCollection("pricing_plans", PricingPlanSchema, PRICING_PLANS, nameOf);
validateCollection(
  "pricing_examples",
  PricingExampleSchema,
  PRICING_EXAMPLES,
  nameOf,
);
validateCollection("feature_items", FeatureItemSchema, FEATURE_ITEMS, nameOf);
validateCollection("faq_items", FaqItemSchema, FAQ_ITEMS, nameOf);

/* ---- Bilan ---- */
if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} payload(s) invalide(s) sur ${checked} vérifié(s) :\n`);
  for (const failure of failures) {
    console.error(`— ${failure}\n`);
  }
  process.exit(1);
}

console.log(
  `✓ ${checked} payloads valides (${PAGES.length} pages gérées, ${PAGES.reduce(
    (n, p) => n + p.sections.length,
    0,
  )} sections, ${
    TESTIMONIALS.length +
    PRICING_PLANS.length +
    PRICING_EXAMPLES.length +
    FEATURE_ITEMS.length +
    FAQ_ITEMS.length
  } entrées de collections).`,
);
