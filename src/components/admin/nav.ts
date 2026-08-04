import {
  BadgeCheck,
  CircleCheck,
  CreditCard,
  FileSignature,
  Images,
  Layers,
  LayoutDashboard,
  Mail,
  MapPin,
  MonitorSmartphone,
  Newspaper,
  ReceiptEuro,
  RefreshCw,
  ScrollText,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Star,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

/* ============================================================
   Source unique de la navigation du back office. Consommée par la
   barre latérale (liens), la barre supérieure (fil d'Ariane) et la
   palette ⌘K : un seul endroit à modifier quand une section apparaît
   ou change de libellé.

   Les icônes viennent toutes de lucide, comme dans les pages. Le jeu
   de SVG maison (src/components/icons.tsx) reste réservé à la vitrine :
   la coque et les pages ne mélangent plus deux traits différents.

   Chaque groupe porte une `icon` de section. Elle ne sert à rien
   aujourd'hui (la barre latérale affiche les groupes en titres), mais
   c'est exactement ce que consommerait un rail d'icônes si l'on devait
   basculer sur la navigation à deux niveaux de l'app praticien : aucune
   page n'aurait alors à changer.
   ============================================================ */

export type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Actif seulement sur une correspondance stricte (cas de /admin). */
  exact?: boolean;
  /** Termes supplémentaires pour la recherche de la palette ⌘K. */
  keywords?: string;
};

export type NavGroup = {
  key: string;
  title: string;
  icon: LucideIcon;
  /** Groupe visible par les seuls administrateurs. */
  adminOnly?: boolean;
  links: NavLink[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    key: "contenu",
    title: "Contenu",
    icon: Layers,
    links: [
      {
        href: "/admin/contenu",
        label: "Contenu du site",
        icon: Layers,
        keywords: "sections accueil home textes",
      },
      { href: "/admin/pages", label: "Pages", icon: MonitorSmartphone },
      {
        href: "/admin/blog",
        label: "Actualités",
        icon: Newspaper,
        keywords: "blog articles",
      },
      { href: "/admin/collections", label: "Collections", icon: Star },
      {
        href: "/admin/medias",
        label: "Médias",
        icon: Images,
        keywords: "images fichiers bibliothèque",
      },
      {
        href: "/admin/contacts",
        label: "Demandes de contact",
        icon: Mail,
        keywords: "messages formulaire",
      },
    ],
  },
  {
    key: "seo",
    title: "Référencement",
    icon: TrendingUp,
    links: [
      {
        href: "/admin/seo",
        label: "Métas et redirections",
        icon: Search,
        keywords: "seo title description 404",
      },
      {
        href: "/admin/villes",
        label: "Villes SEO",
        icon: MapPin,
        keywords: "local pages villes",
      },
    ],
  },
  {
    key: "facturation",
    title: "Facturation",
    icon: CreditCard,
    adminOnly: true,
    links: [
      {
        href: "/admin",
        label: "Tableau de bord",
        icon: LayoutDashboard,
        exact: true,
        keywords: "accueil kpi",
      },
      {
        href: "/admin/billing/abonnements",
        label: "Abonnements",
        icon: BadgeCheck,
        keywords: "clients souscriptions actives",
      },
      {
        href: "/admin/billing/souscriptions",
        label: "Souscriptions",
        icon: CircleCheck,
        keywords: "lien paiement cabinet",
      },
      {
        href: "/admin/billing/incidents",
        label: "Incidents",
        icon: ShieldAlert,
        keywords: "impayés relance",
      },
      {
        href: "/admin/billing/mandats",
        label: "Mandats SEPA",
        icon: FileSignature,
        keywords: "prélèvement rum iban",
      },
      { href: "/admin/billing/factures", label: "Factures", icon: ReceiptEuro },
      {
        href: "/admin/billing/synchro",
        label: "Synchro app",
        icon: RefreshCw,
        keywords: "provisioning tâches",
      },
    ],
  },
  {
    key: "administration",
    title: "Administration",
    icon: ShieldCheck,
    adminOnly: true,
    links: [
      { href: "/admin/utilisateurs", label: "Utilisateurs", icon: Users },
      {
        href: "/admin/reglages",
        label: "Réglages du site",
        icon: Settings,
        keywords: "paramètres configuration",
      },
      {
        href: "/admin/audit",
        label: "Journal d'audit",
        icon: ScrollText,
        keywords: "historique log",
      },
    ],
  },
];

export function isLinkActive(link: NavLink, pathname: string): boolean {
  if (link.exact) return pathname === link.href;
  return pathname === link.href || pathname.startsWith(`${link.href}/`);
}

/** Liens visibles pour un rôle donné (barre latérale et palette ⌘K). */
export function navGroupsFor(role: "admin" | "editor"): NavGroup[] {
  return NAV_GROUPS.filter((g) => !g.adminOnly || role === "admin");
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
