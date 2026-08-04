"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  ExternalLink,
  LogOut,
  Menu,
  Moon,
  Search,
  Sun,
} from "lucide-react";
import { browserClient } from "@/lib/supabase/browser";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAdminTheme } from "./AdminThemeProvider";
import AdminFrame from "./AdminFrame";
import { breadcrumbsFor } from "./nav";

/* ============================================================
   Barre supérieure : fil d'Ariane à gauche, palette de navigation,
   sélecteur de thème et menu utilisateur à droite.

   Le <header> garde son filet et son flou sur toute la largeur, mais
   son CONTENU passe dans AdminFrame. C'est ce qui aligne le fil
   d'Ariane sur le <h1> de chaque page : auparavant seul <main> était
   plafonné, et sur un écran de 2600px les deux démarraient à 382px
   d'écart.
   ============================================================ */

function initials(name: string, email: string): string {
  const source = name.trim() || email;
  const parts = source.split(/[\s.@_-]+/).filter(Boolean);
  return (parts.slice(0, 2).map((p) => p[0] ?? "").join("") || "?").toUpperCase();
}

export default function AdminTopbar({
  pathname,
  displayName,
  email,
  role,
  onOpenNav,
  onOpenPalette,
}: {
  pathname: string;
  displayName: string;
  email: string;
  role: "admin" | "editor";
  onOpenNav: () => void;
  onOpenPalette: () => void;
}) {
  const [signingOut, setSigningOut] = useState(false);
  const { mode, toggle } = useAdminTheme();
  const dark = mode === "dark";

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await browserClient().auth.signOut();
    } catch {
      /* Supabase non configuré ou session déjà expirée : on sort quand même. */
    }
    window.location.assign("/admin/login");
  }

  const crumbs = breadcrumbsFor(pathname);

  return (
    <header className="sticky top-0 z-30 h-12 shrink-0 border-b border-border bg-card/60 backdrop-blur-md">
      <AdminFrame className="flex h-12 items-center gap-2.5">
        <button
          type="button"
          onClick={onOpenNav}
          aria-label="Ouvrir la navigation"
          className="mp-icon-btn grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground lg:hidden"
        >
          <Menu className="size-[18px]" />
        </button>

        {/* Fil d'Ariane */}
        <nav aria-label="Fil d'Ariane" className="flex min-w-0 items-center gap-2 text-sm">
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1;
            return (
              <span key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-2">
                {index > 0 && (
                  <ChevronRight
                    className="size-3.5 shrink-0 text-muted-foreground/50"
                    aria-hidden="true"
                  />
                )}
                {crumb.href && !last ? (
                  <Link
                    href={crumb.href}
                    className="truncate text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    className={
                      last
                        ? "truncate font-medium text-[color:var(--mp-text-2)]"
                        : "truncate text-muted-foreground"
                    }
                  >
                    {crumb.label}
                  </span>
                )}
              </span>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Palette de navigation — réellement câblée (⌘K / Ctrl+K). */}
          <button
            type="button"
            onClick={onOpenPalette}
            className="hidden h-8 min-w-[190px] items-center gap-2 rounded-full border border-border bg-card/70 px-3 text-sm text-muted-foreground transition-colors hover:border-input hover:bg-card hover:text-foreground md:flex"
          >
            <Search className="size-3.5" />
            <span className="flex-1 text-left">Rechercher</span>
            <kbd className="rounded border border-border bg-secondary px-1.5 font-mono text-2xs">
              ⌘K
            </kbd>
          </button>
          <button
            type="button"
            onClick={onOpenPalette}
            aria-label="Rechercher"
            className="mp-icon-btn grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden"
          >
            <Search className="size-4" />
          </button>

          {/* Sélecteur de thème : explicite, persisté, jamais l'OS. */}
          <button
            type="button"
            onClick={toggle}
            aria-label={dark ? "Passer au thème clair" : "Passer au thème sombre"}
            className="mp-icon-btn relative grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <Sun
              className={`absolute size-4 transition-all duration-300 ease-mp ${
                dark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"
              }`}
            />
            <Moon
              className={`absolute size-4 transition-all duration-300 ease-mp ${
                dark ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"
              }`}
            />
          </button>

          {/* Menu utilisateur */}
          <DropdownMenu>
            <DropdownMenuTrigger className="ml-0.5 flex items-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar className="size-8">
                <AvatarFallback className="bg-[color:var(--mp-tone-primary-bg)] text-xs font-semibold text-[color:var(--mp-blue-mid)]">
                  {initials(displayName, email)}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{displayName}</span>
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {email}
                </span>
                <span className="mt-1 w-fit rounded-full bg-[color:var(--mp-tone-primary-bg)] px-2 py-0.5 text-xs font-medium text-[color:var(--mp-blue-mid)]">
                  {role === "admin" ? "Administrateur" : "Éditeur"}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/" target="_blank">
                  <ExternalLink className="size-4" />
                  Voir le site
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onSelect={(e) => {
                  e.preventDefault();
                  handleSignOut();
                }}
                disabled={signingOut}
              >
                <LogOut className="size-4" />
                {signingOut ? "Déconnexion en cours" : "Se déconnecter"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </AdminFrame>
    </header>
  );
}
