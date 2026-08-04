import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { getStaffUser } from "@/lib/admin/auth";
import { serviceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { PageHeading, Notice } from "@/components/admin/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
   Synchro app — tâches manuelles vitrine → application (intérim
   tant que l'app n'expose pas d'endpoint de renouvellement) :
   renouvellement, suspension, réactivation, rollback. L'opérateur
   reporte le payload dans l'app puis marque la tâche « faite ».
   ============================================================ */

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Synchro app" };

type SyncTaskRow = {
  id: string;
  subscription_id: string;
  kind: string;
  payload: Record<string, unknown>;
  status: string;
  created_at: string;
  done_at: string | null;
  subscription: { cabinet_name: string } | null;
};

const KIND_BADGE: Record<
  string,
  { label: string; variant: "blue" | "red" | "green" | "amber" | "gray" }
> = {
  renewal: { label: "Renouvellement", variant: "blue" },
  suspension: { label: "Suspension", variant: "red" },
  reactivation: { label: "Réactivation", variant: "green" },
  rollback_renewal: { label: "Annulation renouvellement", variant: "amber" },
};

const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

function fmtDateTime(value: string | null): string {
  return value ? dateTimeFmt.format(new Date(value)) : "—";
}

/** Action serveur : marque une tâche « faite » (re-vérifie le rôle admin). */
async function marquerFait(formData: FormData) {
  "use server";

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  /* Défense en profondeur : utilisateur + rôle admin (JWT) + miroir profiles. */
  const staff = await getStaffUser();
  if (!staff || staff.role !== "admin") {
    throw new Error("Accès réservé aux administrateurs.");
  }
  const service = serviceClient();
  if (!service) {
    throw new Error("Supabase non configuré.");
  }
  const { data: profile } = await service
    .from("profiles")
    .select("role")
    .eq("id", staff.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    throw new Error("Accès réservé aux administrateurs.");
  }

  const { error } = await service
    .from("app_sync_tasks")
    .update({
      status: "done",
      done_at: new Date().toISOString(),
      done_by: staff.id,
    })
    .eq("id", id)
    .eq("status", "pending");

  if (error) {
    throw new Error(`Mise à jour impossible : ${error.message}`);
  }

  await logAudit({
    action: "admin.sync_task.done",
    entityType: "app_sync_tasks",
    entityId: id,
    actorId: staff.id,
    actorEmail: staff.email,
  });

  revalidatePath("/admin/billing/synchro");
  revalidatePath("/admin");
}

export default async function SynchroPage() {
  const service = serviceClient();

  if (!service) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeading title="Synchro app" />
        <Notice tone="warn" title="Supabase non configuré">
          Les tâches de synchronisation sont indisponibles.
        </Notice>
      </div>
    );
  }

  const [pending, done] = await Promise.all([
    service
      .from("app_sync_tasks")
      .select(
        "id, subscription_id, kind, payload, status, created_at, done_at, subscription:subscriptions(cabinet_name)",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    service
      .from("app_sync_tasks")
      .select(
        "id, subscription_id, kind, payload, status, created_at, done_at, subscription:subscriptions(cabinet_name)",
      )
      .eq("status", "done")
      .order("done_at", { ascending: false })
      .limit(20),
  ]);

  const pendingRows = (pending.data ?? []) as unknown as SyncTaskRow[];
  const doneRows = (done.data ?? []) as unknown as SyncTaskRow[];

  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        title="Synchro app"
        description="Tâches à reporter manuellement dans l'application (prolongation d'abonnement, suspension…). Reportez le contenu du payload côté app, puis marquez la tâche « faite »."
      />

      {(pending.error ?? done.error) && (
        <Notice tone="bad" title="Erreur de lecture">
          {(pending.error ?? done.error)?.message}
        </Notice>
      )}

      <Card className="overflow-hidden">
        {pendingRows.length === 0 ? (
          <div className="px-4 py-14 text-center text-[13px] text-muted-foreground">
            Aucune tâche en attente. Tout est à jour.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Type</TableHead>
                  <TableHead className="min-w-[200px]">Cabinet</TableHead>
                  <TableHead className="min-w-[280px]">Payload</TableHead>
                  <TableHead className="w-44 text-right">Créée le</TableHead>
                  <TableHead className="w-36 text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRows.map((task) => {
                  const badge = KIND_BADGE[task.kind] ?? {
                    label: task.kind,
                    variant: "gray" as const,
                  };
                  return (
                    <TableRow key={task.id}>
                      <TableCell>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/billing/abonnements/${task.subscription_id}`}
                          className="font-medium text-foreground hover:text-primary"
                        >
                          {task.subscription?.cabinet_name ?? "—"}
                        </Link>
                      </TableCell>
                      <TableCell className="align-top">
                        <pre className="max-w-[460px] overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs tabular-nums text-muted-foreground">
                          {JSON.stringify(task.payload, null, 2)}
                        </pre>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                        {fmtDateTime(task.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <form action={marquerFait}>
                          <input type="hidden" name="id" value={task.id} />
                          <Button type="submit" variant="outline" size="sm">
                            Marquer fait
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
          Faites récemment{" "}
          <span className="text-[13px] font-normal text-muted-foreground">
            (20 max)
          </span>
        </h2>
        <Card className="overflow-hidden">
          {doneRows.length === 0 ? (
            <div className="px-4 py-14 text-center text-[13px] text-muted-foreground">
              Aucune tâche traitée pour le moment.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Type</TableHead>
                    <TableHead className="min-w-[200px]">Cabinet</TableHead>
                    <TableHead className="w-44 text-right">Créée le</TableHead>
                    <TableHead className="w-44 text-right">Faite le</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {doneRows.map((task) => {
                    const badge = KIND_BADGE[task.kind] ?? {
                      label: task.kind,
                      variant: "gray" as const,
                    };
                    return (
                      <TableRow key={task.id}>
                        <TableCell>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {task.subscription?.cabinet_name ?? "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                          {fmtDateTime(task.created_at)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                          {fmtDateTime(task.done_at)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
