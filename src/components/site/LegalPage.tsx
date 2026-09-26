import RichTextRenderer from "@/components/cms/RichTextRenderer";
import { getPageSections, pick } from "@/lib/cms/pages";
import { Section } from "./Kit";
import PageHead from "./PageHead";
import p from "./prose.module.css";

/**
 * Page légale gérée (CGU, CGV, DPA, confidentialité, cookies, mentions) :
 * en-tête centré, puis le texte riche du CMS en largeur de lecture.
 */
export default async function LegalPage({ slug, label }: { slug: string; label: string }) {
  const sections = await getPageSections(slug);
  const hero = pick(sections, "hero", "page_hero");
  const body = pick(sections, "body", "rich_text");

  return (
    <>
      <PageHead
        content={hero}
        crumbs={[
          { label: "Accueil", href: "/" },
          { label, href: slug },
        ]}
        tint="blue"
        textOnly
      />
      <Section>
        <div className={p.prose}>
          <RichTextRenderer body={body.body} />
        </div>
      </Section>
    </>
  );
}
