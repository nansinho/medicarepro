import type { Metadata } from "next";
import { PageHero } from "@/components/Sections";
import RichTextRenderer from "@/components/cms/RichTextRenderer";
import { getPageSections, pick } from "@/lib/cms/pages";
import { pageMetadata } from "@/lib/cms/seo";
import a from "@/components/article.module.css";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/dpa");
}

export default async function DpaPage() {
  const sections = await getPageSections("/dpa");
  const hero = pick(sections, "hero", "page_hero");
  const body = pick(sections, "body", "rich_text");

  return (
    <>
      <PageHero
        kicker={hero.kicker ?? ""}
        title={hero.title}
        lead={hero.lead}
        image={hero.image?.path}
      />
      <div className="wrap">
        <div className={a.body}>
          <RichTextRenderer body={body.body} />
        </div>
      </div>
    </>
  );
}
