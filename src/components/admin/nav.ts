import {
  BadgeCheck,
  CheckCircle,
  FileText,
  Grid,
  Image as ImageIcon,
  Invoice,
  Key,
  Layers,
  Mail,
  MapPin,
  Monitor,
  Refresh,
  Shield,
  Signature,
  Star,
  TrendingUp,
  Users,
} from "@/components/icons";

/* ============================================================
   Source unique de la navigation du back office. Consommée par
   la barre latérale (liens) et par la barre supérieure (fil
   d'Ariane) : un seul endroit à modifier quand une section
   apparaît ou change de libellé.
   ============================================================ */

export type NavLink = {
  href: string;
  label: string;
  icon: (props: React.SVGProps<SVGSVGElement>) => React.ReactNode;
  /** Actif seulement sur une correspondance stricte (cas de /admin). */
  exact?: boolean;
};

export type NavGroup = {
  title: string;
  /** Groupe visible par les seuls administrateurs. */
  adminOnly?: boolean;
  links: NavLink[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Contenu",
    links: [
      { href: "/admin/contenu", label: "Contenu du site", icon: Layers },
      { href: "/admin/pages", label: "Pages", icon: Monitor },
      { href: "/admin/blog", label: "Actualités", icon: FileText },
      { href: "/admin/collections", label: "Collections", icon: Star },
      { href: "/admin/medias", label: "Médias", icon: ImageIcon },
      { href: "/admin/contacts", label: "Demandes de contact", icon: Mail },
    ],
  },
  {
    title: "Référencement",
    links: [
      { href: "/admin/seo", label: "Métas et redirections", icon: TrendingUp },
      { href: "/admin/villes", label: "Villes SEO", icon: MapPin },
    ],
  },
  {
    title: "Facturation",
    adminOnly: true,
    links: [
      { href: "/admin", label: "Tableau de bord", icon: Grid, exact: true },
      {
        href: "/admin/billing/abonnements",
        label: "Abonnements",
        icon: BadgeCheck,
      },
      {
        href: "/admin/billing/souscriptions",
        label: "Souscriptions",
        icon: CheckCircle,
      },
      { href: "/admin/billing/incidents", label: "Incidents", icon: Shield },
      { href: "/admin/billing/mandats", label: "Mandats SEPA", icon: Signature },
      { href: "/admin/billing/factures", label: "Factures", icon: Invoice },
      { href: "/admin/billing/synchro", label: "Synchro app", icon: Refresh },
    ],
  },
  {
    title: "Administration",
    adminOnly: true,
    links: [
      { href: "/admin/utilisateurs", label: "Utilisateurs", icon: Users },
      { href: "/admin/reglages", label: "Réglages du site", icon: Key },
      { href: "/admin/audit", label: "Journal d'audit", icon: FileText },
    ],
  },
];

export function isLinkActive(link: NavLink, pathname: string): boolean {
  if (link.exact) return pathname === link.href;
  return pathname === link.href || pathname.startsWith(`${link.href}/`);
}

export type Crumb = { label: string; href?: string };

/* Libellés des sous-pages connues (dernier segment d'URL). */
const LEAF_LABELS: Record<string, string> = {
  nouveau: "Nouvel article",
  apercu: "Aperçu",
};

function humanize(segment: string): string {
  const text = decodeURIComponent(segment).replace(/-/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Fil d'Ariane d'une route admin : groupe (non cliquable), page de
 * navigation (cliquable si on est plus bas), puis sous-page éventuelle.
 */
export function breadcrumbsFor(pathname: string): Crumb[] {
  /* Le lien de nav le plus spécifique qui couvre la route courante. */
  let best: { group: NavGroup; link: NavLink } | null = null;
  for (const group of NAV_GROUPS) {
    for (const link of group.links) {
      if (!isLinkActive(link, pathname)) continue;
      if (!best || link.href.length > best.link.href.length) {
        best = { group, link };
      }
    }
  }

  if (!best) return [{ label: "Back office" }];

  const isDeeper = pathname !== best.link.href;
  const crumbs: Crumb[] = [
    { label: best.group.title },
    {
      label: best.link.label,
      href: isDeeper ? best.link.href : undefined,
    },
  ];

  if (isDeeper) {
    const rest = pathname.slice(best.link.href.length + 1).split("/");
    const leaf = rest[rest.length - 1];
    /* Un identifiant technique n'apporte rien : on nomme l'écran. */
    const isId = /^[0-9a-f-]{8,}$/i.test(leaf) || /^\d+$/.test(leaf);
    if (isId) crumbs.push({ label: "Fiche" });
    else crumbs.push({ label: LEAF_LABELS[leaf] ?? humanize(leaf) });
  }

  return crumbs;
}
