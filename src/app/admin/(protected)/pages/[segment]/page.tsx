import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { serviceClient } from "@/lib/supabase/service";
import { FALLBACK_PAGES } from "@/lib/cms/fallback";
import { slugForSegment } from "@/lib/admin/pageRoutes";
import { SECTION_TYPE_LABELS } from "@/lib/admin/forms/sectionMeta";
import PageEditor, {
  type EditorSlot,
} from "@/components/admin/pages/PageEditor";
import type { SectionType } from "@/lib/cms/sections.schema";
import { PageHeading } from "@/components/admin/shared";
import { Button } from "@/components/ui/button";

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
    <div className="flex flex-col gap-4">
      <div>
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="-ml-2 mb-1.5 text-muted-foreground"
        >
          <Link href="/admin/pages">
            <ChevronLeft />
            Toutes les pages
          </Link>
        </Button>
        <PageHeading
          title={page.title}
          description={`${slug} · ${slots.length} sections · enregistrement auto en brouillon.`}
        />
      </div>
      <PageEditor slug={slug} slots={slots} />
    </div>
  );
}
