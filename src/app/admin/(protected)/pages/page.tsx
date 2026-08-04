import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { serviceClient } from "@/lib/supabase/service";
import { FALLBACK_PAGES } from "@/lib/cms/fallback";
import { segmentForSlug } from "@/lib/admin/pageRoutes";
import { PageHeading } from "@/components/admin/shared";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Pages" };

const DATE_FMT = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function AdminPagesListPage() {
  const service = serviceClient();

  const draftCounts = new Map<string, number>();
  const updatedAt = new Map<string, string>();
  if (service) {
    const { data } = await service
      .from("pages")
      .select("slug, page_sections(section_key, draft, updated_at)");
    for (const page of data ?? []) {
      const sections = (page.page_sections ?? []) as {
        draft: unknown;
        updated_at: string | null;
      }[];
      draftCounts.set(page.slug, sections.filter((s) => s.draft != null).length);
      const latest = sections
        .map((s) => s.updated_at)
        .filter(Boolean)
        .sort()
        .pop();
      if (latest) updatedAt.set(page.slug, latest);
    }
  }

  const pages = Object.values(FALLBACK_PAGES);
  const totalDrafts = [...draftCounts.values()].reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        title="Pages du site"
        description="Textes et visuels de chaque page du site vitrine."
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[240px]">Page</TableHead>
                <TableHead>URL</TableHead>
                <TableHead className="w-24 text-right">Sections</TableHead>
                <TableHead className="w-40">Brouillon</TableHead>
                <TableHead className="w-48 text-right">Dernière modification</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages.map((page) => {
                const drafts = draftCounts.get(page.slug) ?? 0;
                const last = updatedAt.get(page.slug);
                const href = `/admin/pages/${segmentForSlug(page.slug)}`;
                return (
                  <TableRow key={page.slug} className="group cursor-pointer">
                    <TableCell>
                      <Link href={href} className="font-medium text-foreground hover:text-primary">
                        {page.title}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{page.slug}</TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {page.sections.length}
                    </TableCell>
                    <TableCell>
                      {drafts > 0 ? (
                        <Badge variant="amber">
                          {drafts} non publiée{drafts > 1 ? "s" : ""}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">À jour</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {last ? DATE_FMT.format(new Date(last)) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={href}>
                        <ChevronRight className="size-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between border-t bg-secondary px-4 py-2.5 text-xs text-muted-foreground">
          <span>{pages.length} pages gérées</span>
          <span>
            {totalDrafts > 0 ? `${totalDrafts} section(s) en brouillon` : "Aucun brouillon en attente"}
          </span>
        </div>
      </Card>
    </div>
  );
}
