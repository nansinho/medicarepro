"use client";

import Link from "next/link";
import { Globe } from "@/components/icons";
import { NAV_GROUPS, isLinkActive, type NavLink } from "./nav";
import { cn } from "@/lib/utils";

/* ============================================================
   Barre latérale du back office. Registre Vercel/Stripe : surface
   blanche à filet, rangées denses, entrée active en teinte d'accent
   avec un rail bleu à gauche. Aucun dégradé, aucune capitale forcée.
   Les sections réservées (facturation, administration) ne sont
   rendues que pour le rôle admin ; la vérification autoritaire reste
   côté serveur (requireStaff + getIsAdmin).
   ============================================================ */

export default function AdminSidebar({
  pathname,
  role,
  open,
  onNavigate,
}: {
  pathname: string;
  role: "admin" | "editor";
  open: boolean;
  onNavigate: () => void;
}) {
  function renderLink(link: NavLink) {
    const Icon = link.icon;
    const active = isLinkActive(link, pathname);
    return (
      <Link
        key={link.href}
        href={link.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] text-muted-foreground transition-colors",
          "hover:bg-secondary hover:text-foreground",
          active &&
            "bg-accent font-medium text-primary hover:bg-accent hover:text-primary before:absolute before:left-0 before:top-1/2 before:h-4 before:w-[3px] before:-translate-y-1/2 before:rounded-r before:bg-primary",
        )}
      >
        <Icon
          width={16}
          height={16}
          className={cn("shrink-0", active ? "text-primary" : "text-muted-foreground/80")}
        />
        <span className="min-w-0 flex-1 truncate">{link.label}</span>
      </Link>
    );
  }

  return (
    <aside
      className={cn(
        "z-40 flex w-[236px] shrink-0 flex-col border-r border-border bg-card",
        "fixed inset-y-0 left-0 -translate-x-full transition-transform duration-200 ease-out",
        "lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
        open && "translate-x-0 shadow-2xl",
      )}
      aria-label="Sections du back office"
    >
      {/* En-tête */}
      <Link
        href="/admin/contenu"
        onClick={onNavigate}
        className="flex h-12 items-center gap-2 border-b border-border px-4"
      >
        <span
          aria-hidden="true"
          className="grid size-[22px] shrink-0 place-items-center rounded-md bg-foreground text-[11px] font-semibold text-background"
        >
          M
        </span>
        <span className="text-[13px] font-semibold tracking-tight text-foreground">
          MediCare Pro
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground/70">Back office</span>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        {NAV_GROUPS.map((group) => {
          if (group.adminOnly && role !== "admin") return null;
          return (
            <div key={group.title} className="mb-1">
              <p className="flex items-center gap-1.5 px-2 pb-1 pt-3 text-[11px] font-medium text-muted-foreground/70">
                <span className="size-1 rounded-full bg-border" aria-hidden="true" />
                {group.title}
              </p>
              {group.links.map((link) => renderLink(link))}
            </div>
          );
        })}
      </nav>

      {/* Pied : lien vitrine */}
      <div className="border-t border-border p-2">
        <Link
          href="/"
          target="_blank"
          className="flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Globe width={15} height={15} className="shrink-0 text-muted-foreground/70" />
          Voir le site
        </Link>
      </div>
    </aside>
  );
}
