import type { Metadata } from "next";
import { serviceClient } from "@/lib/supabase/service";
import { formatEuros } from "@/lib/checkout/pricing";
import { PageHeading, Notice } from "@/components/admin/shared";
import SubscribeLinkForm from "@/components/admin/billing/SubscribeLinkForm";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/* ============================================================
   Souscriptions de cabinets existants.

   Sert le cas des cabinets qui utilisent déjà le logiciel sans payer : on
   leur ouvre un accès à l'espace abonnement, où ils choisissent leur formule
   et règlent. Aucun compte n'est créé, aucune donnée n'est touchée.

   Cet écran disparaîtra en grande partie le jour où l'application affichera
   son bouton « Gérer mon abonnement » : il restera le suivi.
   ============================================================ */

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Souscriptions" };

type OrderRow = {
  id: string;
  kind: string;
  plan: string;
  status: string;
  amount_cents: number;
  currency: string;
  monetico_reference: string;
  app_cabinet_id: string;
  billing_snapshot: { cabinetName?: string } | null;
  created_at: string;
};

type LinkRow = {
  id: string;
  app_cabinet_id: string;
  cabinet: { name?: string } | null;
  created_via: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
};

const KIND_LABEL: Record<string, string> = {
  initial: "Inscription",
  attach: "Souscription",
  resubscribe: "Reprise",
  card_update: "Changement de carte",
  plan_change: "Changement de formule",
};

const ORDER_STATUS: Record<
  string,
  { label: string; variant: "green" | "amber" | "red" | "gray" | "blue" }
> = {
  pending: { label: "En attente de paiement", variant: "blue" },
  paid: { label: "Payée", variant: "amber" },
  applied: { label: "Appliquée", variant: "green" },
  amount_mismatch: { label: "Montant inattendu", variant: "red" },
  expired: { label: "Abandonnée", variant: "gray" },
  failed: { label: "Refusée", variant: "red" },
};

const dtFmt = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});
const fmt = (v: string | null) => (v ? dtFmt.format(new Date(v)) : "—");

export default async function SouscriptionsPage() {
  const service = serviceClient();

  if (!service) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeading title="Souscriptions" />
        <Notice tone="warn" title="Base non configurée">
          Supabase n&apos;est pas configuré : impossible d&apos;émettre un lien.
        </Notice>
      </div>
    );
  }

  const [{ data: orders }, { data: links }] = await Promise.all([
    service
      .from("subscription_orders")
      .select(
        "id, kind, plan, status, amount_cents, currency, monetico_reference, app_cabinet_id, billing_snapshot, created_at",
      )
      .neq("kind", "initial")
      .order("created_at", { ascending: false })
      .limit(50),
    service
      .from("portal_links")
      .select(
        "id, app_cabinet_id, cabinet, created_via, expires_at, consumed_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const orderRows = (orders ?? []) as OrderRow[];
  const linkRows = (links ?? []) as LinkRow[];

  return (
    <div className="flex flex-col gap-5">
      <PageHeading
        title="Souscriptions"
        description="Ouvrir l'espace abonnement à un cabinet qui utilise déjà le logiciel. Il y choisit sa formule et règle : aucun compte n'est créé, ses dossiers ne sont pas touchés."
      />

      <Card>
        <CardHeader>
          <CardTitle>Nouveau lien de souscription</CardTitle>
        </CardHeader>
        <CardContent>
          <SubscribeLinkForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Commandes hors tunnel</CardTitle>
        </CardHeader>
        {orderRows.length === 0 ? (
          <CardContent>
            <p className="text-[13px] text-muted-foreground">
              Aucune commande pour l&apos;instant. Elles apparaîtront ici dès
              qu&apos;un cabinet aura ouvert un paiement depuis son espace.
            </p>
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cabinet</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Formule</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Référence</TableHead>
                <TableHead>État</TableHead>
                <TableHead>Ouverte le</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orderRows.map((o) => {
                const st = ORDER_STATUS[o.status] ?? {
                  label: o.status,
                  variant: "gray" as const,
                };
                return (
                  <TableRow key={o.id}>
                    <TableCell>
                      {o.billing_snapshot?.cabinetName ?? o.app_cabinet_id}
                    </TableCell>
                    <TableCell>{KIND_LABEL[o.kind] ?? o.kind}</TableCell>
                    <TableCell>
                      {o.plan === "MONTHLY" ? "Mensuel" : "Annuel"}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatEuros(o.amount_cents)}
                    </TableCell>
                    <TableCell className="font-mono">
                      {o.monetico_reference}
                    </TableCell>
                    <TableCell>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </TableCell>
                    <TableCell>{fmt(o.created_at)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Liens d&apos;accès récents</CardTitle>
        </CardHeader>
        {linkRows.length === 0 ? (
          <CardContent>
            <p className="text-[13px] text-muted-foreground">
              Aucun lien émis pour l&apos;instant.
            </p>
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cabinet</TableHead>
                <TableHead>Origine</TableHead>
                <TableHead>Émis le</TableHead>
                <TableHead>État</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linkRows.map((l) => {
                const used = Boolean(l.consumed_at);
                const expired = !used && new Date(l.expires_at) < new Date();
                return (
                  <TableRow key={l.id}>
                    <TableCell>{l.cabinet?.name ?? l.app_cabinet_id}</TableCell>
                    <TableCell>
                      {l.created_via === "admin" ? "Back-office" : "Application"}
                    </TableCell>
                    <TableCell>{fmt(l.created_at)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={used ? "green" : expired ? "gray" : "blue"}
                      >
                        {used
                          ? `Ouvert ${fmt(l.consumed_at)}`
                          : expired
                            ? "Expiré sans usage"
                            : "En attente"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
