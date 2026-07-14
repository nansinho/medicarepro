"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { browserClient } from "@/lib/supabase/browser";
import {
  BadgeCheck,
  FileText,
  Globe,
  Grid,
  Image as ImageIcon,
  Invoice,
  Key,
  Layers,
  Lock,
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
import s from "./Admin.module.css";

/* ============================================================
   Navigation du back office. Client component : état actif
   (usePathname) + déconnexion Supabase (browserClient).
   Sections : Contenu (staff), SEO (staff, remplie au fil des
   lots), Facturation + Administration (admin uniquement).
   Les entrées n'apparaissent que quand leur module existe.
   ============================================================ */

type NavLink = {
  href: string;
  label: string;
  icon: (props: React.SVGProps<SVGSVGElement>) => React.ReactNode;
  exact?: boolean;
};

const NAV_CONTENU: NavLink[] = [
  { href: "/admin/contenu", label: "Contenu du site", icon: Layers },
  { href: "/admin/pages", label: "Pages", icon: Monitor },
  { href: "/admin/blog", label: "Actualités", icon: FileText },
  { href: "/admin/collections", label: "Collections", icon: Star },
  { href: "/admin/medias", label: "Médias", icon: ImageIcon },
  { href: "/admin/contacts", label: "Demandes de contact", icon: Mail },
];

const NAV_SEO: NavLink[] = [
  { href: "/admin/seo", label: "Référencement", icon: TrendingUp },
  { href: "/admin/villes", label: "Villes SEO", icon: MapPin },
];

const NAV_FACTURATION: NavLink[] = [
  { href: "/admin", label: "Tableau de bord", icon: Grid, exact: true },
  { href: "/admin/billing/abonnements", label: "Abonnements", icon: BadgeCheck },
  { href: "/admin/billing/incidents", label: "Incidents", icon: Shield },
  { href: "/admin/billing/mandats", label: "Mandats SEPA", icon: Signature },
  { href: "/admin/billing/factures", label: "Factures", icon: Invoice },
  { href: "/admin/billing/synchro", label: "Synchro app", icon: Refresh },
];

/* Administration : /admin/utilisateurs et /admin/audit s'ajouteront
   avec leurs lots. */
const NAV_ADMINISTRATION: NavLink[] = [
  { href: "/admin/utilisateurs", label: "Utilisateurs", icon: Users },
  { href: "/admin/reglages", label: "Réglages du site", icon: Key },
  { href: "/admin/audit", label: "Journal d'audit", icon: FileText },
];

export default function AdminSidebar({
  displayName,
  email,
  role,
}: {
  displayName: string;
  email: string;
  role: "admin" | "editor";
}) {
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);

  function isActive(link: NavLink): boolean {
    return link.exact
      ? pathname === link.href
      : pathname === link.href || pathname.startsWith(`${link.href}/`);
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await browserClient().auth.signOut();
    } catch {
      /* Supabase non configuré ou session déjà expirée : on sort quand même. */
    }
    /* Navigation complète : le proxy doit relire les cookies effacés. */
    window.location.assign("/admin/login");
  }

  function renderLink(link: NavLink) {
    const Icon = link.icon;
    return (
      <Link
        key={link.href}
        href={link.href}
        className={`${s.navLink} ${isActive(link) ? s.navLinkActive : ""}`}
        aria-current={isActive(link) ? "page" : undefined}
      >
        <Icon width={17} height={17} />
        {link.label}
      </Link>
    );
  }

  function renderSection(title: string, links: NavLink[]) {
    if (links.length === 0) return null;
    return (
      <>
        <span className={s.navSection}>{title}</span>
        {links.map(renderLink)}
      </>
    );
  }

  return (
    <aside className={s.sidebar}>
      <Link href="/" className={s.sideBrand} title="Voir le site">
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG statique : next/image ne l'optimiserait pas */}
        <img
          src="/logo-icon.svg?v=7"
          alt=""
          width={26}
          height={26}
          style={{ background: "#fff", borderRadius: 8, padding: 3, flex: "none" }}
        />
        <span className={s.sideBrandName}>
          MediCare Pro
          <span className={s.sideBrandSub}>Back office</span>
        </span>
      </Link>

      <nav className={s.nav} aria-label="Navigation du back office">
        {renderSection("Contenu", NAV_CONTENU)}
        {renderSection("SEO", NAV_SEO)}
        {role === "admin" && renderSection("Facturation", NAV_FACTURATION)}
        {role === "admin" &&
          renderSection("Administration", NAV_ADMINISTRATION)}
      </nav>

      <div className={s.sideFoot}>
        <Link href="/" target="_blank" className={s.siteLink}>
          <Globe width={15} height={15} />
          Voir le site
        </Link>
        <p className={s.sideUser}>
          <b>{displayName}</b>
          {email}
        </p>
        <button
          type="button"
          className={s.logoutBtn}
          onClick={handleSignOut}
          disabled={signingOut}
        >
          <Lock width={15} height={15} />
          {signingOut ? "Déconnexion…" : "Déconnexion"}
        </button>
      </div>
    </aside>
  );
}
