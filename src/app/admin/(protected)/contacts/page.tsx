import type { Metadata } from "next";
import { serviceClient } from "@/lib/supabase/service";
import { PageHeading, Notice } from "@/components/admin/shared";
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

/* ============================================================
   Demandes de contact (table contact_requests) — lecture seule
   en v1 : la qualification (statuts, notes, assignation) viendra
   avec le CRM léger.
   ============================================================ */

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Demandes de contact" };

type ContactRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  practitioners: string | null;
  message: string;
  status: string;
  created_at: string;
};

const STATUS: Record<string, { label: string; variant: "blue" | "amber" | "green" | "gray" | "red" }> = {
  new: { label: "Nouveau", variant: "blue" },
  in_progress: { label: "En cours", variant: "amber" },
  replied: { label: "Répondu", variant: "green" },
  closed: { label: "Clos", variant: "gray" },
  spam: { label: "Spam", variant: "red" },
};

const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

function excerpt(message: string, max = 120): string {
  const clean = message.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export default async function ContactsPage() {
  const service = serviceClient();

  if (!service) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeading title="Demandes de contact" />
        <Notice tone="warn" title="Supabase non configuré">
          Les demandes de contact sont indisponibles.
        </Notice>
      </div>
    );
  }

  const { data, error } = await service
    .from("contact_requests")
    .select("id, name, email, phone, practitioners, message, status, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as ContactRow[];

  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        title="Demandes de contact"
        description={`Formulaire de contact du site (${rows.length} affichée(s), 200 max). Lecture seule pour l'instant, répondez directement par email.`}
      />

      {error && <Notice tone="bad" title="Erreur de lecture">{error.message}</Notice>}

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-4 py-14 text-center text-[13px] text-muted-foreground">
            Aucune demande de contact pour le moment.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px]">Contact</TableHead>
                  <TableHead className="w-24 text-right">Praticiens</TableHead>
                  <TableHead className="w-28">Statut</TableHead>
                  <TableHead className="min-w-[280px]">Message</TableHead>
                  <TableHead className="w-40 text-right">Reçue le</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const st = STATUS[r.status] ?? { label: r.status, variant: "gray" as const };
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium text-foreground">{r.name}</div>
                        <div className="text-xs text-muted-foreground">
                          <a href={`mailto:${r.email}`} className="hover:text-primary">{r.email}</a>
                          {r.phone ? ` · ${r.phone}` : ""}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                        {r.practitioners ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[420px] truncate text-muted-foreground" title={r.message}>
                        {excerpt(r.message)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                        {dateTimeFmt.format(new Date(r.created_at))}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
