import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { getStaffUser } from "@/lib/admin/auth";
import { serviceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import s from "@/components/admin/Admin.module.css";

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

const KIND_BADGE: Record<string, { label: string; tone: string }> = {
  renewal: { label: "Renouvellement", tone: "tBlue" },
  suspension: { label: "Suspension", tone: "tRed" },
  reactivation: { label: "Réactivation", tone: "tGreen" },
  rollback_renewal: { label: "Annulation renouvellement", tone: "tAmber" },
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
      <>
        <header className={s.pageHead}>
          <h1 className={s.pageTitle}>Synchro app</h1>
        </header>
        <p className={s.banner}>
          Supabase non configuré : les tâches de synchronisation sont
          indisponibles.
        </p>
      </>
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
    <>
      <header className={s.pageHead}>
        <h1 className={s.pageTitle}>Synchro app</h1>
        <p className={s.pageDesc}>
          Tâches à reporter manuellement dans l&apos;application
          (prolongation d&apos;abonnement, suspension…). Reportez le contenu
          du payload côté app, puis marquez la tâche « faite ».
        </p>
      </header>

      {(pending.error ?? done.error) && (
        <p className={s.banner}>
          Erreur de lecture : {(pending.error ?? done.error)?.message}
        </p>
      )}

      <div className={s.card}>
        {pendingRows.length === 0 ? (
          <p className={s.empty}>Aucune tâche en attente. Tout est à jour.</p>
        ) : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Cabinet</th>
                  <th>Payload</th>
                  <th>Créée le</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pendingRows.map((task) => {
                  const badge = KIND_BADGE[task.kind] ?? {
                    label: task.kind,
                    tone: "tGray",
                  };
                  return (
                    <tr key={task.id}>
                      <td>
                        <span className={`${s.badge} ${s[badge.tone]}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td>
                        <Link
                          href={`/admin/billing/abonnements/${task.subscription_id}`}
                          className={s.tdMain}
                        >
                          {task.subscription?.cabinet_name ?? "—"}
                        </Link>
                      </td>
                      <td>
                        <code className={s.code}>
                          {JSON.stringify(task.payload, null, 2)}
                        </code>
                      </td>
                      <td className={s.tdNum}>{fmtDateTime(task.created_at)}</td>
                      <td>
                        <form action={marquerFait}>
                          <input type="hidden" name="id" value={task.id} />
                          <button type="submit" className={s.btnSmall}>
                            Marquer fait
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <h2 className={s.sectionTitle}>Faites récemment (20 max)</h2>
      <div className={s.card}>
        {doneRows.length === 0 ? (
          <p className={s.empty}>Aucune tâche traitée pour le moment.</p>
        ) : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Cabinet</th>
                  <th>Créée le</th>
                  <th>Faite le</th>
                </tr>
              </thead>
              <tbody>
                {doneRows.map((task) => {
                  const badge = KIND_BADGE[task.kind] ?? {
                    label: task.kind,
                    tone: "tGray",
                  };
                  return (
                    <tr key={task.id}>
                      <td>
                        <span className={`${s.badge} ${s[badge.tone]}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td>{task.subscription?.cabinet_name ?? "—"}</td>
                      <td className={s.tdNum}>{fmtDateTime(task.created_at)}</td>
                      <td className={s.tdNum}>{fmtDateTime(task.done_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
