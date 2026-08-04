"use client";

import Link from "next/link";
import { ExternalLink, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { navGroupsFor, isLinkActive, type NavLink } from "./nav";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/* ============================================================
   Barre latérale du back office, alignée sur le panneau de
   navigation de l'app praticien : surface carte, titres de groupe en
   micro-capitales espacées, entrée active en pastille teintée (et non
   en rail), glissement de 2px au survol avec l'icône qui respire.

   Un seul niveau, volontairement. L'app praticien pose un rail navy
   pleine hauteur devant son panneau parce qu'elle compte une dizaine
   de sections ; ici il y en a quatre, et seulement deux pour un rôle
   éditeur. Un rail pleine hauteur portant deux icônes recréerait
   exactement le vide que le back office devait perdre. Les icônes de
   section existent malgré tout dans nav.ts : basculer sur deux niveaux
   ne demanderait aucune modification des pages.

   Les sections réservées ne sont rendues que pour le rôle admin ; la
   vérification autoritaire reste côté serveur (requireStaff).
   ============================================================ */

export default function AdminSidebar({
  pathname,
  role,
  open,
  collapsed,
  onToggleCollapsed,
  onNavigate,
}: {
  pathname: string;
  role: "admin" | "editor";
  open: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onNavigate: () => void;
}) {
  const groups = navGroupsFor(role);

  function renderLink(link: NavLink) {
    const Icon = link.icon;
    const active = isLinkActive(link, pathname);

    const row = (
      <Link
        key={link.href}
        href={link.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        title={collapsed ? undefined : link.label}
        className={cn(
          "mp-nav-item group flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-cell",
          collapsed && "justify-center px-0",
          active
            ? "bg-[color:var(--mp-tone-primary-bg)] font-semibold text-[color:var(--mp-blue-mid)]"
            : "text-[color:var(--mp-text-2)] hover:bg-[color:var(--mp-tone-navy-bg)] hover:text-[color:var(--mp-blue)]",
        )}
      >
        <Icon className="mp-nav-icon size-4 shrink-0" />
        {!collapsed && <span className="min-w-0 flex-1 truncate">{link.label}</span>}
      </Link>
    );

    if (!collapsed) return row;
    return (
      <Tooltip key={link.href}>
        <TooltipTrigger asChild>{row}</TooltipTrigger>
        <TooltipContent side="right">{link.label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <aside
      style={{
        width: collapsed
          ? "var(--admin-sidebar-collapsed)"
          : "var(--admin-sidebar)",
      }}
      className={cn(
        "z-40 flex shrink-0 flex-col border-r border-border bg-card",
        /* Le repli anime la LARGEUR, jamais un transform : une
           transformation sur un ancêtre effondrerait le halo fixe. */
        "transition-[width,transform] duration-[320ms] ease-mp",
        "fixed inset-y-0 left-0 -translate-x-full",
        "lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0",
        open && "translate-x-0 shadow-lg",
      )}
      aria-label="Sections du back office"
    >
      {/* En-tête, aligné en hauteur sur la barre supérieure. */}
      <Link
        href="/admin/contenu"
        onClick={onNavigate}
        className={cn(
          "flex h-12 shrink-0 items-center gap-2 border-b border-border px-4",
          collapsed && "justify-center px-0",
        )}
      >
        {collapsed ? (
          /* eslint-disable-next-line @next/next/no-img-element -- SVG statique */
          <img src="/logo-icon.svg?v=7" alt="MediCare Pro" width={24} height={24} />
        ) : (
          <BrandLogo size={24} />
        )}
      </Link>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2">
        {groups.map((group) => (
          <div key={group.key} className="mb-3 last:mb-0">
            {collapsed ? (
              <div className="mx-3 mb-1.5 mt-3 border-t border-border first:mt-1" />
            ) : (
              <p className="mb-1 px-3 pt-3 text-2xs font-semibold uppercase tracking-[0.08em] text-[color:var(--mp-text-3)]">
                {group.title}
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {group.links.map((link) => renderLink(link))}
            </div>
          </div>
        ))}
      </nav>

      {/* Pied : lien vitrine + repli */}
      <div
        className={cn(
          "flex shrink-0 items-center gap-1 border-t border-border p-2",
          collapsed && "flex-col",
        )}
      >
        <Link
          href="/"
          target="_blank"
          className={cn(
            "mp-nav-item group flex min-w-0 flex-1 items-center gap-2.5 rounded-[10px] px-3 py-2 text-cell text-[color:var(--mp-text-3)] hover:bg-[color:var(--mp-tone-navy-bg)] hover:text-[color:var(--mp-blue)]",
            collapsed && "justify-center px-0",
          )}
        >
          <ExternalLink className="mp-nav-icon size-4 shrink-0" />
          {!collapsed && <span className="truncate">Voir le site</span>}
        </Link>
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Déplier la navigation" : "Replier la navigation"}
          className="mp-icon-btn hidden size-8 shrink-0 place-items-center rounded-[10px] text-[color:var(--mp-text-3)] hover:bg-[color:var(--mp-tone-navy-bg)] hover:text-[color:var(--mp-blue)] lg:grid"
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </button>
      </div>
    </aside>
  );
}
