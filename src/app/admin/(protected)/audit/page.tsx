import type { Metadata } from "next";
import { serviceClient } from "@/lib/supabase/service";
import s from "@/components/admin/Admin.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Journal d'audit" };

const DATE_FMT = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
});

/* Libellés lisibles des actions les plus courantes (préfixe → phrase). */
function actionLabel(action: string): string {
  const MAP: Record<string, string> = {
    "settings.update": "Réglage modifié",
    "media.upload": "Média(s) téléversé(s)",
    "media.delete": "Média supprimé",
    "user.invite": "Utilisateur invité",
    "user.create_direct": "Compte créé",
    "user.role_change": "Rôle modifié",
    "user.disable": "Compte désactivé",
    "user.enable": "Compte réactivé",
    "post.create": "Article créé",
    "post.update": "Article modifié",
    "post.delete": "Article supprimé",
    "page.publish": "Page publiée",
    "seo.redirect_save": "Redirection créée",
    "seo.meta_update": "Métas SEO modifiées",
    "city.queue_generation": "Villes mises en génération",
    "city.publish": "Villes publiées",
    "collection.create": "Élément de collection créé",
    "collection.update": "Élément de collection modifié",
  };
  if (MAP[action]) return MAP[action];
  if (action.startsWith("post.status.")) return `Article → ${action.slice(12)}`;
  if (action.startsWith("city.review.")) return `Ville → ${action.slice(12)}`;
  return action;
}

export default async function AdminAuditPage() {
  const service = serviceClient();
  if (!service) {
    return (
      <>
        <header className={s.pageHead}>
          <h1 className={s.pageTitle}>Journal d&apos;audit</h1>
        </header>
        <p className={s.banner}>Supabase non configuré.</p>
      </>
    );
  }

  const { data: entries } = await service
    .from("audit_log")
    .select("id, actor_email, action, entity_type, entity_id, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <>
      <header className={s.pageHead}>
        <div>
          <h1 className={s.pageTitle}>Journal d&apos;audit</h1>
          <p className={s.pageDesc}>Les 200 dernières actions du back office.</p>
        </div>
      </header>

      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Quand</th>
              <th>Qui</th>
              <th>Action</th>
              <th>Cible</th>
            </tr>
          </thead>
          <tbody>
            {(entries ?? []).map((entry) => (
              <tr key={entry.id}>
                <td>
                  <span className={s.tdSub}>
                    {entry.created_at
                      ? DATE_FMT.format(new Date(entry.created_at))
                      : "—"}
                  </span>
                </td>
                <td>
                  <span className={s.tdSub}>{entry.actor_email ?? "système"}</span>
                </td>
                <td>
                  <span className={s.tdMain}>{actionLabel(entry.action)}</span>
                </td>
                <td>
                  <span className={s.tdSub}>
                    {entry.entity_type ?? ""}
                    {entry.entity_id ? ` · ${String(entry.entity_id).slice(0, 12)}` : ""}
                  </span>
                </td>
              </tr>
            ))}
            {(entries ?? []).length === 0 && (
              <tr>
                <td colSpan={4}>
                  <span className={s.tdSub}>Aucune action enregistrée.</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
