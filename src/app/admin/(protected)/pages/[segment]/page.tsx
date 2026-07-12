import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { serviceClient } from "@/lib/supabase/service";
import { FALLBACK_PAGES } from "@/lib/cms/fallback";
import { slugForSegment } from "@/lib/admin/pageRoutes";
import { SECTION_TYPE_LABELS } from "@/lib/admin/forms/sectionMeta";
import PageEditor, {
  type EditorSlot,
} from "@/components/admin/pages/PageEditor";
import type { SectionType } from "@/lib/cms/sections.schema";
import s from "@/components/admin/Admin.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Édition de page" };

export default async function AdminPageEditorPage({
  params,
}: {
  params: Promise<{ segment: string }>;
}) {
  const { segment } = await params;
  const slug = slugForSegment(segment);
  const page = FALLBACK_PAGES[slug];
  if (!page) notFound();

  /* Rows DB (payloads publiés + brouillons) par-dessus le fallback. */
  const rowsByKey = new Map<
    string,
    { content: unknown; draft: unknown; updated_at: string | null }
  >();
  const service = serviceClient();
  if (service) {
    const { data } = await service
      .from("pages")
      .select("id, page_sections(section_key, type, content, draft, updated_at)")
      .eq("slug", slug)
      .maybeSingle();
    for (const row of (data?.page_sections ?? []) as {
      section_key: string;
      content: unknown;
      draft: unknown;
      updated_at: string | null;
    }[]) {
      rowsByKey.set(row.section_key, row);
    }
  }

  const slots: EditorSlot[] = page.sections.map((slot) => {
    const row = rowsByKey.get(slot.key);
    const meta = SECTION_TYPE_LABELS[slot.type as SectionType];
    return {
      key: slot.key,
      type: slot.type as SectionType,
      label: meta?.label ?? slot.type,
      description: meta?.description ?? "",
      published: (row?.content ?? slot.content) as Record<string, unknown>,
      draft: (row?.draft ?? null) as Record<string, unknown> | null,
      updatedAt: row?.updated_at ?? null,
    };
  });

  return (
    <>
      <header className={s.pageHead}>
        <div>
          <h1 className={s.pageTitle}>{page.title}</h1>
          <p className={s.pageDesc}>
            {slug} · {slots.length} sections · enregistrement auto en brouillon.
          </p>
        </div>
      </header>
      <PageEditor slug={slug} slots={slots} />
    </>
  );
}
