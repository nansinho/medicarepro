import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  Mail,
  MapPin,
  Newspaper,
  Plus,
  RefreshCw,
  Send,
  Star,
  type LucideIcon,
} from "lucide-react";
import { serverClient } from "@/lib/supabase/server";
import { serviceClient } from "@/lib/supabase/service";
import { PageHeading, StatBand, Notice, type Stat } from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/* ============================================================
   Contenu du site — cockpit du CMS : indicateurs, activité récente
   réelle (demandes de contact, articles), pipeline SEO local et
   accès rapides. Tout est branché sur la base (RLS is_staff / service).
   ============================================================ */

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Contenu du site" };

const nf = new Intl.NumberFormat("fr-FR");
const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  timeZone: "Europe/Paris",
});

type ContactRow = { id: string; name: string; email: string; status: string; created_at: string };
type PostRow = { id: string; title: string; status: string; updated_at: string };

const CONTACT_TONE: Record<string, "blue" | "amber" | "green" | "gray" | "red"> = {
  new: "blue",
  in_progress: "amber",
  replied: "green",
  closed: "gray",
  spam: "red",
};
const CONTACT_LABEL: Record<string, string> = {
  new: "Nouveau",
  in_progress: "En cours",
  replied: "Répondu",
  closed: "Clos",
  spam: "Spam",
};
const POST_TONE: Record<string, "green" | "amber" | "gray"> = {
  published: "green",
  scheduled: "amber",
  draft: "gray",
};
const POST_LABEL: Record<string, string> = {
  published: "Publié",
  scheduled: "Programmé",
  draft: "Brouillon",
};

async function count(
  sb: NonNullable<ReturnType<typeof serviceClient>>,
  table: string,
  filter?: { column: string; value: string },
): Promise<number> {
  let q = sb.from(table).select("*", { count: "exact", head: true });
  if (filter) q = q.eq(filter.column, filter.value);
  const { count: c } = await q;
  return c ?? 0;
}

export default async function AdminContenuPage() {
  const sb = await serverClient();
  const service = serviceClient();

  if (!sb || !service) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeading title="Contenu du site" />
        <Notice tone="warn" title="Supabase non configuré">
          Les données du contenu sont indisponibles sur cet environnement.
        </Notice>
      </div>
    );
  }

  const [
    pages,
    posts,
    testimonials,
    media,
    citiesTotal,
    contactRequests,
    newsletter,
    seeded,
    generated,
    needsReview,
    approved,
    published,
    archived,
    recentContactsRes,
    recentPostsRes,
  ] = await Promise.all([
    count(service, "pages"),
    count(service, "posts", { column: "status", value: "published" }),
    count(service, "testimonials"),
    count(service, "media"),
    count(service, "cities"),
    count(service, "contact_requests"),
    count(service, "newsletter_subscribers"),
    count(service, "cities", { column: "status", value: "seeded" }),
    count(service, "cities", { column: "status", value: "generated" }),
    count(service, "cities", { column: "status", value: "needs_review" }),
    count(service, "cities", { column: "status", value: "approved" }),
    count(service, "cities", { column: "status", value: "published" }),
    count(service, "cities", { column: "status", value: "archived" }),
    service
      .from("contact_requests")
      .select("id, name, email, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    service
      .from("posts")
      .select("id, title, status, updated_at")
      .order("updated_at", { ascending: false })
      .limit(5),
  ]);

  const recentContacts = (recentContactsRes.data ?? []) as ContactRow[];
  const recentPosts = (recentPostsRes.data ?? []) as PostRow[];
  const citiesPublished = published;

  const stats: Stat[] = [
    { label: "Pages gérées", value: nf.format(pages), hint: "Vitrine et pages légales", zero: pages === 0, icon: FileText, tone: "primary" },
    { label: "Articles publiés", value: nf.format(posts), hint: "Blog du site", zero: posts === 0, icon: Newspaper, tone: "primary" },
    { label: "Témoignages", value: nf.format(testimonials), hint: "Avis affichés sur le site", zero: testimonials === 0, icon: Star, tone: "sky" },
    { label: "Médias", value: nf.format(media), hint: "Bibliothèque d'images", zero: media === 0, icon: ImageIcon, tone: "sky" },
    { label: "Villes SEO publiées", value: nf.format(citiesPublished), hint: `Sur ${nf.format(citiesTotal)} préparées`, zero: citiesPublished === 0, icon: MapPin, tone: "navy" },
    { label: "Demandes de contact", value: nf.format(contactRequests), hint: "Reçues via le formulaire", zero: contactRequests === 0, icon: Mail, tone: contactRequests > 0 ? "amber" : "navy" },
    { label: "Abonnés newsletter", value: nf.format(newsletter), hint: "Inscriptions au total", zero: newsletter === 0, icon: Send, tone: "success" },
  ];

  const tiles: { icon: LucideIcon; label: string; count: number; sub: string; href: string }[] = [
    { icon: FileText, label: "Pages", count: pages, sub: "Vitrine et légales", href: "/admin/pages" },
    { icon: Newspaper, label: "Actualités", count: posts, sub: "Articles du blog", href: "/admin/blog" },
    { icon: ImageIcon, label: "Médias", count: media, sub: "Images", href: "/admin/medias" },
    { icon: Star, label: "Collections", count: testimonials, sub: "Témoignages", href: "/admin/collections" },
    { icon: MapPin, label: "Villes SEO", count: citiesTotal, sub: `${nf.format(citiesPublished)} en ligne`, href: "/admin/villes" },
    { icon: Mail, label: "Demandes", count: contactRequests, sub: "Formulaire", href: "/admin/contacts" },
  ];

  const pipeline = [
    { n: seeded, label: "SEEDED", sub: "Préparées" },
    { n: generated, label: "GENERATED", sub: "Rédigées" },
    { n: needsReview, label: "NEEDS_REVIEW", sub: "À relire" },
    { n: approved, label: "APPROVED", sub: "Prêtes" },
    { n: published, label: "PUBLISHED", sub: "En ligne" },
    { n: archived, label: "ARCHIVED", sub: "Retirées" },
  ];

  const mix = [
    { label: "Médias", value: media, color: "#1e457f" },
    { label: "Pages", value: pages, color: "#2b6fd6" },
    { label: "Articles", value: posts, color: "#79b0ea" },
  ].filter((m) => m.value > 0);
  const mixTotal = mix.reduce((s, m) => s + m.value, 0);

  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        title="Contenu du site"
        description="Ce que la vitrine publie aujourd'hui, l'activité récente et les espaces à gérer."
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/contenu">
                <RefreshCw />
                Actualiser
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/admin/blog/nouveau">
                <Plus />
                Nouvel article
              </Link>
            </Button>
          </>
        }
      />

      <StatBand stats={stats} />

      {/* Activité récente réelle + accès rapides */}
      <div className="grid gap-4 xl:grid-cols-3 @ultra/page:grid-cols-4">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>
              <Mail className="size-4 text-[color:var(--mp-blue-mid)]" />
              Demandes de contact récentes
            </CardTitle>
            <Button variant="ghost" size="xs" asChild>
              <Link href="/admin/contacts">
                Tout voir
                <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          {recentContacts.length > 0 ? (
            <div className="divide-y divide-border">
              {recentContacts.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="grid size-8 flex-none place-items-center rounded-md bg-secondary text-[11px] font-semibold text-muted-foreground ring-1 ring-inset ring-border">
                    {(c.name || c.email).slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-foreground">{c.name}</span>
                    <a href={`mailto:${c.email}`} className="block truncate text-xs text-muted-foreground hover:text-primary">
                      {c.email}
                    </a>
                  </span>
                  <Badge variant={CONTACT_TONE[c.status] ?? "gray"}>
                    {CONTACT_LABEL[c.status] ?? c.status}
                  </Badge>
                  <span className="w-14 flex-none text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {dateFmt.format(new Date(c.created_at))}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <CardContent>
              <p className="text-[13px] text-muted-foreground">Aucune demande reçue pour le moment.</p>
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Accès rapides</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2.5">
            {tiles.map((t) => (
              <Link
                key={t.label}
                href={t.href}
                className="mp-lift group flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3.5 shadow-sm hover:border-[color:var(--mp-blue-soft)]"
              >
                <span className="flex items-center justify-between">
                  <span className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
                    <t.icon className="size-4" />
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </span>
                <span className="mt-0.5 font-mono text-xl font-medium tabular-nums text-foreground">
                  {nf.format(t.count)}
                </span>
                <span className="text-[13px] font-medium text-foreground">{t.label}</span>
                <span className="truncate text-[11px] text-muted-foreground">{t.sub}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Derniers articles + répartition */}
      <div className="grid gap-4 xl:grid-cols-3 @ultra/page:grid-cols-4">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>
              <Newspaper className="size-4 text-[color:var(--mp-blue-mid)]" />
              Derniers articles
            </CardTitle>
            <Button variant="ghost" size="xs" asChild>
              <Link href="/admin/blog">
                Tout voir
                <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          {recentPosts.length > 0 ? (
            <div className="divide-y divide-border">
              {recentPosts.map((p) => (
                <Link
                  key={p.id}
                  href={`/admin/blog/${p.id}`}
                  className="mp-row group flex items-center gap-3 px-5 py-2.5"
                >
                  <FileText className="size-4 flex-none text-muted-foreground/60" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{p.title}</span>
                  <Badge variant={POST_TONE[p.status] ?? "gray"}>{POST_LABEL[p.status] ?? p.status}</Badge>
                  <span className="w-14 flex-none text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {dateFmt.format(new Date(p.updated_at))}
                  </span>
                  <ChevronRight className="size-4 flex-none text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              ))}
            </div>
          ) : (
            <CardContent>
              <p className="text-[13px] text-muted-foreground">Aucun article pour le moment.</p>
            </CardContent>
          )}
        </Card>

        {mix.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Répartition du contenu</CardTitle>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">{nf.format(mixTotal)}</span>
            </CardHeader>
            <CardContent className="flex flex-col gap-3.5">
              <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-secondary ring-1 ring-inset ring-border">
                {mix.map((m) => (
                  <div
                    key={m.label}
                    style={{ width: `${(m.value / mixTotal) * 100}%`, background: m.color }}
                    className="h-full first:rounded-l-full last:rounded-r-full"
                  />
                ))}
              </div>
              <div className="flex flex-col gap-2">
                {mix.map((m) => (
                  <span key={m.label} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="size-2.5 rounded-[3px]" style={{ background: m.color }} />
                    <span className="flex-1 text-foreground">{m.label}</span>
                    <b className="font-mono tabular-nums text-foreground">{nf.format(m.value)}</b>
                    <span className="w-10 text-right font-mono text-[11px] text-muted-foreground/70">
                      {Math.round((m.value / mixTotal) * 100)} %
                    </span>
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pipeline SEO local (données réelles) */}
      <Card>
        <CardHeader>
          <CardTitle>
            <MapPin className="size-4 text-[color:var(--mp-blue-mid)]" />
            Référencement local
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {nf.format(citiesPublished)} / {nf.format(citiesTotal)} en ligne
            </span>
            <Button variant="ghost" size="xs" asChild>
              <Link href="/admin/villes">
                Gérer
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
            {pipeline.map((step, i) => (
              <div
                key={step.label}
                className="relative rounded-lg border border-border bg-card p-3 shadow-sm"
              >
                <span
                  className="absolute inset-y-2.5 left-0 w-[3px] rounded-r"
                  style={{ background: step.n > 0 ? "var(--primary)" : "var(--border)" }}
                />
                {i < pipeline.length - 1 && (
                  <ChevronRight className="absolute -right-[9px] top-1/2 z-10 size-3.5 -translate-y-1/2 bg-background text-muted-foreground/40 max-xl:hidden" />
                )}
                <div className={step.n > 0 ? "font-mono text-2xl font-medium tabular-nums text-foreground" : "font-mono text-2xl tabular-nums text-muted-foreground/60"}>
                  {nf.format(step.n)}
                </div>
                <div className="mt-1 font-mono text-[10px] tracking-tight text-primary">{step.label}</div>
                <div className="text-[11px] text-muted-foreground">{step.sub}</div>
              </div>
            ))}
          </div>
          {generated + needsReview + approved + published === 0 && (
            <div className="mt-3">
              <Notice tone="warn" title="Génération IA non configurée" action={
                <Button variant="outline" size="sm" asChild>
                  <Link href="/admin/reglages">Réglages</Link>
                </Button>
              }>
                Les {nf.format(seeded)} villes sont préparées, aucune page n&apos;est encore rédigée.
                Ajoutez <span className="font-mono text-xs">ANTHROPIC_API_KEY</span> pour lancer la génération.
              </Notice>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
