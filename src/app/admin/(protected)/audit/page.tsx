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

/* Ton du badge selon la nature de l'action : création/succès (vert),
   modification (bleu), suppression/échec (rouge), neutre (gris). */
function actionVariant(action: string): "green" | "blue" | "red" | "gray" {
  if (action.startsWith("post.status.") || action.startsWith("city.review.")) return "blue";
  if (/delete|disable|remove|revoke/.test(action)) return "red";
  if (/create|invite|upload|enable|publish|save|add/.test(action)) return "green";
  if (/update|change|edit|rename|move/.test(action)) return "blue";
  return "gray";
}

export default async function AdminAuditPage() {
  const service = serviceClient();
  if (!service) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeading title="Journal d'audit" />
        <Notice tone="warn" title="Supabase non configuré">
          Les entrées du journal sont indisponibles.
        </Notice>
      </div>
    );
  }

  const { data: entries } = await service
    .from("audit_log")
    .select("id, actor_email, action, entity_type, entity_id, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = entries ?? [];

  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        title="Journal d'audit"
        description="Les 200 dernières actions du back office."
      />

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-4 py-14 text-center text-[13px] text-muted-foreground">
            Aucune action enregistrée.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40 text-right">Quand</TableHead>
                  <TableHead className="min-w-[180px]">Qui</TableHead>
                  <TableHead className="min-w-[200px]">Action</TableHead>
                  <TableHead className="min-w-[200px]">Cible</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {entry.created_at ? DATE_FMT.format(new Date(entry.created_at)) : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                      {entry.actor_email ?? "système"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={actionVariant(entry.action)}>
                        {actionLabel(entry.action)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                      {entry.entity_type ?? ""}
                      {entry.entity_id ? ` · ${String(entry.entity_id).slice(0, 12)}` : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
