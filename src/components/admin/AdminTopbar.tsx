"use client";

import { useEffect, useState } from "react";
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
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { breadcrumbsFor } from "./nav";

/* ============================================================
   Barre supérieure : fil d'Ariane à gauche, barre de commande,
   bascule de thème et menu utilisateur à droite. Sticky, elle donne
   au back office son chrome d'application.
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
}: {
  pathname: string;
  displayName: string;
  email: string;
  role: "admin" | "editor";
  onOpenNav: () => void;
}) {
  const [dark, setDark] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  /* La bascule agit sur le div .admin-scope (tokens scopés). Défaut clair :
     on ne suit pas prefers-color-scheme. */
  useEffect(() => {
    document.querySelector(".admin-scope")?.classList.toggle("dark", dark);
  }, [dark]);

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
    <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2.5 border-b border-border bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:px-6">
      <button
        type="button"
        onClick={onOpenNav}
        aria-label="Ouvrir la navigation"
        className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground lg:hidden"
      >
        <Menu className="size-[18px]" />
      </button>

      {/* Fil d'Ariane */}
      <nav aria-label="Fil d'Ariane" className="flex min-w-0 items-center gap-2 text-[13px]">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <span key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-2">
              {index > 0 && (
                <ChevronRight className="size-3.5 shrink-0 text-border" aria-hidden="true" />
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
                    last ? "truncate font-medium text-foreground" : "truncate text-muted-foreground"
                  }
                >
                  {crumb.label}
                </span>
              )}
            </span>
          );
        })}
      </nav>

      <div className="flex-1" />

      {/* Barre de commande */}
      <button
        type="button"
        className="hidden h-7 min-w-[200px] items-center gap-2 rounded-md border border-border bg-secondary px-2.5 text-[13px] text-muted-foreground/80 transition-colors hover:border-input hover:bg-card hover:text-muted-foreground md:flex"
      >
        <Search className="size-3.5" />
        <span className="flex-1 text-left">Rechercher</span>
        <kbd className="rounded border border-border border-b-2 bg-card px-1.5 font-mono text-[11px] text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      {/* Bascule de thème */}
      <button
        type="button"
        onClick={() => setDark((d) => !d)}
        aria-label={dark ? "Passer au thème clair" : "Passer au thème sombre"}
        className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </button>

      {/* Menu utilisateur */}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-full p-0.5 pr-1 outline-none transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring">
          <Avatar className="size-7">
            <AvatarFallback className="bg-primary/10 text-[11px] font-semibold text-primary">
              {initials(displayName, email)}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="text-[13px] font-medium">{displayName}</span>
            <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>
            <span className="mt-1 w-fit rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
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
    </header>
  );
}
