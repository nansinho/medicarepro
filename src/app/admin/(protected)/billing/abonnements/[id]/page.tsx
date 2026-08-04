import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Building2,
  CalendarClock,
  Download,
  Landmark,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { serviceClient } from "@/lib/supabase/service";
import { formatEuros, planLabel } from "@/lib/checkout/pricing";
import { activeChange } from "@/lib/billing/changes";
import { arreterReconduction, retirerDemande } from "../actions";
import { PageHeading, StatBand, Notice, type Stat } from "@/components/admin/shared";
import { KeyValue } from "@/components/admin/kit/KeyValue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/* ============================================================
   Détail d'un abonnement : fiche complète + mandat SEPA lié,
   factures, notifications IPN et tâches de synchro. Server
   component en lecture seule (sauf l'arrêt de reconduction).
   ============================================================ */

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Détail abonnement" };

type SubscriptionRow = {
  id: string;
  app_cabinet_id: string;
  app_user_id: string;
  cabinet_name: string;
  cabinet_email: string;
  admin_email: string;
  admin_name: string;
  invoice_prefix: string;
  plan: "MONTHLY" | "ANNUAL";
  extra_collaborators: number;
  first_payment_cents: number;
  renewal_amount_cents: number;
  currency: string;
  status: string;
  started_at: string;
  current_period_end: string;
  monetico_reference: string;
  monetico_order_date: string | null;
  renewal_count: number;
  last_renewal_at: string | null;
  recurrence_stopped_at: string | null;
  dunning_started_at: string | null;
  dunning_failure_count: number;
  last_failure_at: string | null;
  last_failure_code: string | null;
  grace_until: string | null;
  sepa_mandate_id: string | null;
  notes: string | null;
  created_at: string;
};
type MandateRow = {
  id: string;
  rum: string;
  status: string;
  scheme: string;
  iban_last4: string;
  bic: string | null;
  account_holder: string;
  signed_at: string | null;
  last_presented_at: string | null;
  legal_hold: boolean;
};
type InvoiceRow = { id: string; number: string; kind: string; amount_cents: number; currency: string; issued_at: string };
type IpnRow = { id: number; code_retour: string; amount_cents: number | null; currency: string | null; received_at: string };
type SyncTaskRow = { id: string; kind: string; status: string; payload: Record<string, unknown>; created_at: string; done_at: string | null };
type ConsentRow = {
  id: string;
  label_text: string;
  documents: { document: string; version: string; sha256?: string }[];
  accepted_at: string;
  full_name: string;
  email: string;
  client_ip: string | null;
};

const PLAN_LABEL: Record<string, string> = { MONTHLY: "Mensuel", ANNUAL: "Annuel" };
type Variant = "green" | "amber" | "red" | "gray" | "blue";
const SUB_BADGE: Record<string, { label: string; v: Variant }> = {
  active: { label: "Actif", v: "green" },
  pending_mandate: { label: "Mandat à signer", v: "amber" },
  past_due: { label: "Impayé", v: "amber" },
  suspended: { label: "Suspendu", v: "red" },
  canceled: { label: "Résilié", v: "gray" },
  expired: { label: "Expiré", v: "gray" },
};
const MANDATE_BADGE: Record<string, { label: string; v: Variant }> = {
  draft: { label: "Brouillon", v: "gray" },
  sent: { label: "Envoyé", v: "blue" },
  signed: { label: "Signé", v: "green" },
  active: { label: "Actif", v: "green" },
  revoked: { label: "Révoqué", v: "red" },
  lapsed: { label: "Caduc", v: "gray" },
};
const INVOICE_KIND: Record<string, string> = {
  card_first: "1er paiement carte",
  card_renewal: "Reconduction carte",
  sdd_renewal: "Renouvellement SEPA",
  credit_note: "Avoir",
};
const CHANGE_KIND: Record<string, string> = {
  plan_change: "Changement de formule",
  card_update: "Changement de carte",
  cancel: "Résiliation",
};
const TASK_KIND: Record<string, string> = {
  renewal: "Renouvellement",
  suspension: "Suspension",
  reactivation: "Réactivation",
  rollback_renewal: "Annulation renouvellement",
};

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Europe/Paris" });
const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" });
const fmtDate = (v: string | null) => (v ? dateFmt.format(new Date(v)) : "—");
const fmtDateTime = (v: string | null) => (v ? dateTimeFmt.format(new Date(v)) : "—");

function statusBadge(map: Record<string, { label: string; v: Variant }>, status: string) {
  const b = map[status] ?? { label: status, v: "gray" as Variant };
  return <Badge variant={b.v}>{b.label}</Badge>;
}

/**
 * Liste clé-valeur.
 *
 * L'ancien rendu justifiait la valeur À DROITE : dans une carte large,
 * cela creusait plusieurs centaines de pixels de vide entre « Plan » et sa
 * valeur, le même défaut que la page étirée, tourné de 90°. Deux colonnes
 * fixes alignées sur la ligne de base réglent le problème et font gagner
 * ~8px par rangée. Le filtre `hidden` est conservé (l'appelant l'utilise).
 */
function KV({ items }: { items: { k: ReactNode; v: ReactNode; mono?: boolean; wide?: boolean; hidden?: boolean }[] }) {
  return <KeyValue items={items.filter((i) => !i.hidden)} />;
}

export default async function AbonnementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = serviceClient();

  if (!service) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeading title="Détail abonnement" />
        <Notice tone="warn" title="Supabase non configuré">Le détail de l&apos;abonnement est indisponible.</Notice>
      </div>
    );
  }

  const { data: subData } = await service
    .from("subscriptions")
    .select(
      "id, app_cabinet_id, app_user_id, cabinet_name, cabinet_email, admin_email, admin_name, invoice_prefix, plan, extra_collaborators, first_payment_cents, renewal_amount_cents, currency, status, started_at, current_period_end, monetico_reference, monetico_order_date, renewal_count, last_renewal_at, recurrence_stopped_at, dunning_started_at, dunning_failure_count, last_failure_at, last_failure_code, grace_until, sepa_mandate_id, notes, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!subData) notFound();
  const sub = subData as SubscriptionRow;

  const [mandates, invoices, ipns, tasks, consents] = await Promise.all([
    service.from("sepa_mandates").select("id, rum, status, scheme, iban_last4, bic, account_holder, signed_at, last_presented_at, legal_hold").eq("subscription_id", sub.id).order("created_at", { ascending: false }),
    service.from("invoices").select("id, number, kind, amount_cents, currency, issued_at").eq("subscription_id", sub.id).order("issued_at", { ascending: false }),
    service.from("ipn_events").select("id, code_retour, amount_cents, currency, received_at").eq("reference", sub.monetico_reference).order("received_at", { ascending: false }),
    service.from("app_sync_tasks").select("id, kind, status, payload, created_at, done_at").eq("subscription_id", sub.id).order("created_at", { ascending: false }),
    service.from("consent_records").select("id, label_text, documents, accepted_at, full_name, email, client_ip").eq("subscription_id", sub.id).order("accepted_at", { ascending: false }),
  ]);

  const pendingChange = await activeChange(service, sub.id);

  const mandateRows = (mandates.data ?? []) as MandateRow[];
  const invoiceRows = (invoices.data ?? []) as InvoiceRow[];
  const ipnRows = (ipns.data ?? []) as IpnRow[];
  const taskRows = (tasks.data ?? []) as SyncTaskRow[];
  const consentRows = (consents.data ?? []) as ConsentRow[];
  const recurrenceOn = !sub.recurrence_stopped_at;
  const hasMandate = mandateRows.length > 0;

  const stats: Stat[] = [
    { label: "Renouvellement", value: formatEuros(sub.renewal_amount_cents), hint: recurrenceOn ? "Reconduction active" : "Reconduction arrêtée" },
    { label: "Fin de période", value: fmtDate(sub.current_period_end), hint: PLAN_LABEL[sub.plan] ?? sub.plan },
    { label: "Échéances encaissées", value: sub.renewal_count, hint: sub.last_renewal_at ? `Dernière : ${fmtDate(sub.last_renewal_at)}` : "Aucune à ce jour", zero: sub.renewal_count === 0 },
    { label: "Collaborateurs", value: sub.extra_collaborators, hint: "Postes supplémentaires", zero: sub.extra_collaborators === 0 },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        title={sub.cabinet_name}
        description={
          <span className="inline-flex items-center gap-2">
            Abonnement {PLAN_LABEL[sub.plan] ?? sub.plan}
            {statusBadge(SUB_BADGE, sub.status)}
          </span>
        }
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/billing/abonnements">Tous les abonnements</Link>
          </Button>
        }
      />

      {sub.dunning_started_at && (
        <Notice
          tone="bad"
          title={`Paiement refusé par la banque — ${sub.dunning_failure_count} refus consécutif${sub.dunning_failure_count > 1 ? "s" : ""}`}
        >
          Premier refus le {fmtDateTime(sub.dunning_started_at)}
          {sub.last_failure_code ? ` (code « ${sub.last_failure_code} »)` : ""}, dernier
          le {fmtDateTime(sub.last_failure_at)}. Le client a été prévenu par email et
          son accès reste entier jusqu&apos;au {fmtDate(sub.grace_until)}. La commande
          récurrente reste vivante côté banque : elle re-présentera peut-être
          l&apos;échéance. La série se referme d&apos;elle-même dès qu&apos;un paiement
          aboutit.
        </Notice>
      )}

      {pendingChange && (
        <Notice
          tone={pendingChange.kind === "cancel" ? "warn" : "info"}
          title={
            pendingChange.kind === "cancel"
              ? `Résiliation demandée, effet le ${fmtDate(pendingChange.effective_at)}`
              : pendingChange.kind === "card_update"
                ? `Changement de carte demandé, à valider le ${fmtDate(pendingChange.effective_at)}`
                : `Changement de formule demandé, à valider le ${fmtDate(pendingChange.effective_at)}`
          }
        >
          {pendingChange.kind === "cancel" ? (
            <>
              La reconduction est arrêtée et l&apos;accès du cabinet court
              jusqu&apos;au {fmtDate(pendingChange.effective_at)}. Aucun montant
              ne sera prélevé d&apos;ici là.
            </>
          ) : (
            <>
              La reconduction est arrêtée : le client doit valider un paiement à
              l&apos;échéance pour repartir
              {pendingChange.target_amount_cents
                ? ` (${formatEuros(pendingChange.target_amount_cents)} annoncés)`
                : ""}
              . Des rappels lui partent à J-7, J-3, le jour même, puis J+3 et
              J+7. Sans validation, l&apos;abonnement passe en impayé puis
              expire après le délai de grâce.
            </>
          )}
        </Notice>
      )}

      {recurrenceOn && !hasMandate && (
        <Notice tone="bad" title="Aucun mandat SEPA rattaché">
          L&apos;échéance du {fmtDate(sub.current_period_end)} ({formatEuros(sub.renewal_amount_cents)}) ne pourra pas être
          prélevée tant qu&apos;un mandat n&apos;est pas signé par le cabinet.
        </Notice>
      )}

      <StatBand stats={stats} />

      <div className="grid items-start gap-4 lg:grid-cols-2 @wide/page:grid-cols-3 @ultra/page:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Souscription</CardTitle>
            {statusBadge(SUB_BADGE, sub.status)}
          </CardHeader>
          <KV
            items={[
              { k: "Plan", v: `${PLAN_LABEL[sub.plan] ?? sub.plan}, ${sub.extra_collaborators} collaborateur(s) suppl.` },
              { k: "1er paiement", v: formatEuros(sub.first_payment_cents), mono: true },
              { k: "Renouvellement", v: formatEuros(sub.renewal_amount_cents), mono: true },
              { k: "Début", v: fmtDate(sub.started_at), mono: true },
              { k: "Fin de période", v: fmtDate(sub.current_period_end), mono: true },
              { k: "Référence Monetico", v: sub.monetico_reference, mono: true },
              { k: "Préfixe factures", v: sub.invoice_prefix, mono: true },
              { k: "Notes", v: sub.notes, wide: true, hidden: !sub.notes },
            ]}
          />
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <RefreshCw className="size-4 text-muted-foreground" />
              Reconduction automatique
            </CardTitle>
            <Badge variant={recurrenceOn ? "green" : "gray"}>{recurrenceOn ? "Active" : "Arrêtée"}</Badge>
          </CardHeader>
          <KV
            items={[
              { k: "Échéances encaissées", v: sub.renewal_count, mono: true },
              { k: "Dernière échéance", v: fmtDateTime(sub.last_renewal_at), mono: true },
              { k: "Prochaine échéance", v: recurrenceOn ? fmtDate(sub.current_period_end) : "—", mono: true },
              { k: "Montant reconduit", v: formatEuros(sub.renewal_amount_cents), mono: true },
              { k: "Date de commande", v: sub.monetico_order_date ?? "—", mono: true },
              { k: "Arrêtée le", v: fmtDateTime(sub.recurrence_stopped_at), mono: true, hidden: recurrenceOn },
            ]}
          />
          <div className="border-t border-border p-4">
            {recurrenceOn && (
              <form action={arreterReconduction} className="mb-2 flex flex-wrap items-center gap-3">
                <input type="hidden" name="id" value={sub.id} />
                <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <input type="checkbox" name="confirm" required className="size-4 accent-[color:var(--destructive)]" />
                  Je confirme l&apos;arrêt définitif
                </label>
                <Button type="submit" variant="destructive" size="sm">Arrêter la reconduction</Button>
              </form>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">
              L&apos;arrêt est envoyé à Monetico et n&apos;est enregistré ici que si la banque l&apos;accuse. L&apos;accès du
              client reste ouvert jusqu&apos;au terme de la période déjà réglée.
            </p>
          </div>
        </Card>

        {pendingChange && (
          <Card>
            <CardHeader>
              <CardTitle>
                <CalendarClock className="size-4 text-muted-foreground" />
                Demande du client
              </CardTitle>
              <Badge variant={pendingChange.kind === "cancel" ? "amber" : "blue"}>
                {CHANGE_KIND[pendingChange.kind] ?? pendingChange.kind}
              </Badge>
            </CardHeader>
            <KV
              items={[
                { k: "Demandé le", v: fmtDateTime(pendingChange.created_at), mono: true },
                { k: "Date d'effet", v: fmtDate(pendingChange.effective_at), mono: true },
                {
                  k: "Formule visée",
                  v:
                    pendingChange.target_plan &&
                    pendingChange.target_extra_collaborators !== null
                      ? planLabel(
                          pendingChange.target_plan,
                          pendingChange.target_extra_collaborators,
                        )
                      : "Inchangée",
                },
                {
                  k: "Montant annoncé",
                  v: pendingChange.target_amount_cents
                    ? formatEuros(pendingChange.target_amount_cents)
                    : "—",
                  mono: true,
                },
                {
                  k: "Motif",
                  v: pendingChange.reason,
                  wide: true,
                  hidden: !pendingChange.reason,
                },
              ]}
            />
            {!sub.recurrence_stopped_at && (
              /* Une demande enregistrée alors que la reconduction n'est pas
                 marquée arrêtée : la banque a refusé l'arrêt, il reste à le
                 poser à la main. Sans ce rappel à l'écran, la tâche ne vit que
                 dans un email d'alerte, et le client se fait prélever. */
              <div className="border-t border-border p-4">
                <Notice tone="bad" title="Arrêt de reconduction à poser au CIC">
                  La banque n&apos;a pas accusé l&apos;arrêt : la demande du
                  client est enregistrée et il a reçu sa confirmation, mais la
                  commande <span className="font-mono">{sub.monetico_reference}</span>{" "}
                  (commande du {sub.monetico_order_date ?? "?"},{" "}
                  {formatEuros(sub.first_payment_cents)}) continuera d&apos;être
                  prélevée tant qu&apos;elle n&apos;aura pas été arrêtée depuis
                  le tableau de bord CIC. À faire avant le{" "}
                  {fmtDate(sub.current_period_end)}.
                </Notice>
              </div>
            )}
            <div className="border-t border-border p-4">
              <form action={retirerDemande} className="mb-2 flex flex-wrap items-center gap-3">
                <input type="hidden" name="id" value={sub.id} />
                <Button type="submit" variant="outline" size="sm">
                  Retirer la demande
                </Button>
              </form>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Retirer la demande rend la formule d&apos;origine, pas la
                reconduction automatique : l&apos;arrêt envoyé à Monetico est
                définitif. Le contrat devra être repayé à l&apos;échéance, et le
                client en est informé par email.
              </p>
            </div>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>
              <Building2 className="size-4 text-muted-foreground" />
              Cabinet et contact
            </CardTitle>
          </CardHeader>
          <KV
            items={[
              { k: "Cabinet", v: sub.cabinet_name },
              { k: "Email cabinet", v: sub.cabinet_email },
              { k: "Administrateur", v: sub.admin_name },
              { k: "Email admin", v: sub.admin_email },
              { k: "ID cabinet (app)", v: sub.app_cabinet_id, mono: true },
              { k: "ID user (app)", v: sub.app_user_id, mono: true },
              { k: "Créé le", v: fmtDateTime(sub.created_at), mono: true },
            ]}
          />
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <Landmark className="size-4 text-muted-foreground" />
              Mandat SEPA
            </CardTitle>
            {!hasMandate && <Badge variant="amber">Manquant</Badge>}
          </CardHeader>
          {!hasMandate ? (
            <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
              <span className="grid size-9 place-items-center rounded-full bg-secondary text-muted-foreground ring-1 ring-inset ring-border">
                <Landmark className="size-4" />
              </span>
              <p className="mt-1 text-[13px] font-medium text-foreground">Aucun mandat lié</p>
              <p className="max-w-[42ch] text-xs text-muted-foreground">
                Le mandat est signé par le cabinet, il ne peut pas être saisi depuis le back office.
              </p>
            </div>
          ) : (
            mandateRows.map((m) => (
              <KV
                key={m.id}
                items={[
                  { k: "RUM", v: m.rum, mono: true },
                  { k: "Statut", v: <span className="inline-flex gap-1.5">{statusBadge(MANDATE_BADGE, m.status)}{m.legal_hold && <Badge variant="red">Litige</Badge>}</span> },
                  { k: "Schéma", v: m.scheme },
                  { k: "Titulaire", v: m.account_holder },
                  { k: "IBAN", v: `•••• ${m.iban_last4}`, mono: true },
                  { k: "BIC", v: m.bic, mono: true, hidden: !m.bic },
                  { k: "Signé le", v: fmtDateTime(m.signed_at), mono: true },
                  { k: "Dernière présentation", v: fmtDate(m.last_presented_at), mono: true },
                ]}
              />
            ))
          )}
        </Card>
      </div>

      {/* Consentement — pleine largeur (fini la colonne étroite) */}
      <Card>
        <CardHeader>
          <CardTitle>
            <ShieldCheck className="size-4 text-muted-foreground" />
            Consentement contractuel
          </CardTitle>
          {consentRows.length > 0 && <Badge variant="green">Accepté</Badge>}
        </CardHeader>
        {consentRows.length === 0 ? (
          <CardContent><p className="text-[13px] text-muted-foreground">Aucune preuve de consentement liée.</p></CardContent>
        ) : (
          consentRows.map((c) => (
            <div key={c.id} className="grid gap-x-8 md:grid-cols-2">
              <KV
                items={[
                  { k: "Accepté le", v: fmtDateTime(c.accepted_at), mono: true },
                  { k: "Par", v: `${c.full_name} (${c.email})` },
                  { k: "Adresse IP", v: c.client_ip ?? "—", mono: true },
                  { k: "Documents", v: (
                    <span className="flex flex-wrap justify-end gap-1">
                      {c.documents.map((d) => (
                        <span key={d.document} className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                          {d.document} v{d.version}
                        </span>
                      ))}
                    </span>
                  ) },
                ]}
              />
              <div className="border-t border-border p-4 md:border-l md:border-t-0">
                <div className="mb-1.5 text-xs text-muted-foreground">Libellé affiché au moment de l&apos;acceptation</div>
                <p className="text-[13px] leading-relaxed text-foreground">« {c.label_text} »</p>
              </div>
            </div>
          ))
        )}
      </Card>

      {/* Factures + IPN + synchro */}
      <div className="grid gap-4 xl:grid-cols-2 @ultra/page:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Factures</CardTitle>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">{invoiceRows.length}</span>
          </CardHeader>
          {invoiceRows.length === 0 ? (
            <CardContent><p className="text-[13px] text-muted-foreground">Aucune facture émise.</p></CardContent>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numéro</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead className="text-right">Émise le</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoiceRows.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-xs text-foreground">{inv.number}</TableCell>
                      <TableCell className="text-muted-foreground">{INVOICE_KIND[inv.kind] ?? inv.kind}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-foreground">{formatEuros(inv.amount_cents)}</TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">{fmtDate(inv.issued_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon-sm" asChild aria-label="Télécharger la facture">
                          <a href={`/admin/billing/factures/${inv.id}/download`}><Download className="size-4" /></a>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader><CardTitle>Notifications de paiement (IPN)</CardTitle></CardHeader>
            {ipnRows.length === 0 ? (
              <CardContent><p className="text-[13px] text-muted-foreground">Aucune notification reçue.</p></CardContent>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code retour</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead className="text-right">Reçue le</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ipnRows.map((ipn) => (
                      <TableRow key={ipn.id}>
                        <TableCell><Badge variant={ipn.code_retour.startsWith("paiement") ? "green" : "amber"} className="font-mono">{ipn.code_retour}</Badge></TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-foreground">{ipn.amount_cents != null ? formatEuros(ipn.amount_cents) : "—"}</TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">{fmtDateTime(ipn.received_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader><CardTitle>Tâches de synchro app</CardTitle></CardHeader>
            {taskRows.length === 0 ? (
              <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
                <p className="text-[13px] font-medium text-foreground">Aucune tâche liée</p>
                <p className="text-xs text-muted-foreground">Aucun provisionnement déclenché pour cet abonnement.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Créée le</TableHead>
                      <TableHead className="text-right">Faite le</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {taskRows.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-foreground">{TASK_KIND[t.kind] ?? t.kind}</TableCell>
                        <TableCell>
                          <Badge variant={t.status === "pending" ? "amber" : t.status === "done" ? "green" : "gray"}>
                            {t.status === "pending" ? "En attente" : t.status === "done" ? "Faite" : "Annulée"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">{fmtDateTime(t.created_at)}</TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">{fmtDateTime(t.done_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
