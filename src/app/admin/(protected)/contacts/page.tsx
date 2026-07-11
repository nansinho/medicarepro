import type { Metadata } from "next";
import { serviceClient } from "@/lib/supabase/service";
import s from "@/components/admin/Admin.module.css";

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

const STATUS_BADGE: Record<string, { label: string; tone: string }> = {
  new: { label: "Nouveau", tone: "tBlue" },
  in_progress: { label: "En cours", tone: "tAmber" },
  replied: { label: "Répondu", tone: "tGreen" },
  closed: { label: "Clos", tone: "tGray" },
  spam: { label: "Spam", tone: "tRed" },
};

const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

/** Tronque le message pour la vue liste (le détail viendra en v2). */
function excerpt(message: string, max = 140): string {
  const clean = message.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export default async function ContactsPage() {
  const service = serviceClient();

  if (!service) {
    return (
      <>
        <header className={s.pageHead}>
          <h1 className={s.pageTitle}>Demandes de contact</h1>
        </header>
        <p className={s.banner}>
          Supabase non configuré : les demandes de contact sont indisponibles.
        </p>
      </>
    );
  }

  const { data, error } = await service
    .from("contact_requests")
    .select("id, name, email, phone, practitioners, message, status, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as ContactRow[];

  return (
    <>
      <header className={s.pageHead}>
        <h1 className={s.pageTitle}>Demandes de contact</h1>
        <p className={s.pageDesc}>
          Formulaire de contact du site ({rows.length} affichées, 200 max).
          Lecture seule pour l&apos;instant — répondez directement par email.
        </p>
      </header>

      {error && (
        <p className={s.banner}>Erreur de lecture : {error.message}</p>
      )}

      <div className={s.card}>
        {rows.length === 0 ? (
          <p className={s.empty}>Aucune demande de contact pour le moment.</p>
        ) : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Praticiens</th>
                  <th>Statut</th>
                  <th>Message</th>
                  <th>Reçue le</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((request) => {
                  const badge = STATUS_BADGE[request.status] ?? {
                    label: request.status,
                    tone: "tGray",
                  };
                  return (
                    <tr key={request.id}>
                      <td>
                        <span className={s.tdMain}>{request.name}</span>
                        <span className={s.tdSub}>
                          <a href={`mailto:${request.email}`}>
                            {request.email}
                          </a>
                          {request.phone ? ` — ${request.phone}` : ""}
                        </span>
                      </td>
                      <td className={s.tdNum}>{request.practitioners ?? "—"}</td>
                      <td>
                        <span className={`${s.badge} ${s[badge.tone]}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td>
                        <span className={s.truncate} title={request.message}>
                          {excerpt(request.message)}
                        </span>
                      </td>
                      <td className={s.tdNum}>
                        {dateTimeFmt.format(new Date(request.created_at))}
                      </td>
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
