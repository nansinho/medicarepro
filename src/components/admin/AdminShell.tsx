"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { TooltipProvider } from "@/components/ui/tooltip";
import AdminSidebar from "./AdminSidebar";
import AdminTopbar from "./AdminTopbar";
import AdminFrame from "./AdminFrame";
import CommandPalette from "./CommandPalette";
import { cn } from "@/lib/utils";

/* ============================================================
   Ossature client du back office : barre latérale + contenu, état du
   tiroir mobile, repli de la barre latérale, palette ⌘K et route
   courante.

   Le contenu des pages reste rendu côté serveur : il arrive en
   `children` et traverse ce composant sans être hydraté.

   Le <main> ne porte plus de largeur en dur : elle vient d'AdminFrame,
   partagé avec la barre supérieure, et le conteneur `@container/page`
   permet aux pages de se recomposer sur la largeur RÉELLE de la
   colonne plutôt que sur celle du viewport (la barre latérale en mange
   248px, et 64px une fois repliée).
   ============================================================ */

const COLLAPSE_KEY = "admin_sidebar_collapsed";

export default function AdminShell({
  displayName,
  email,
  role,
  children,
}: {
  displayName: string;
  email: string;
  role: "admin" | "editor";
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  /* Préférence de repli relue au montage (et non à l'initialisation de
     l'état) : le rendu serveur ne connaît pas localStorage. */
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* navigation privée : on reste déplié. */
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* idem */
      }
      return next;
    });
  }, []);

  /* Tiroir ouvert : on gèle le défilement de la page dessous. */
  useEffect(() => {
    if (!navOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setNavOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [navOpen]);

  /* ⌘K / Ctrl+K, partout dans le back office. */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex min-h-dvh text-foreground">
        <AdminSidebar
          pathname={pathname}
          role={role}
          open={navOpen}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          onNavigate={() => setNavOpen(false)}
        />

        {/* Voile du tiroir mobile */}
        <div
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
          className={cn(
            "fixed inset-0 z-30 bg-foreground/25 lg:hidden",
            navOpen ? "block" : "hidden",
          )}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <AdminTopbar
            pathname={pathname}
            displayName={displayName}
            email={email}
            role={role}
            onOpenNav={() => setNavOpen(true)}
            onOpenPalette={() => setPaletteOpen(true)}
          />
          {/* relative z-[1] : le contenu passe AU-DESSUS du halo d'ambiance. */}
          <main className="relative z-[1] min-w-0 flex-1 pb-14 pt-7">
            <AdminFrame>
              <div className="@container/page">{children}</div>
            </AdminFrame>
          </main>
        </div>

        <CommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          role={role}
        />
      </div>
    </TooltipProvider>
  );
}
