"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import AdminSidebar from "./AdminSidebar";
import AdminTopbar from "./AdminTopbar";
import { cn } from "@/lib/utils";

/* ============================================================
   Ossature client du back office : grille barre latérale + contenu,
   état du tiroir de navigation (mobile) partagé entre la barre
   supérieure et la barre latérale, et route courante.
   Le contenu des pages reste rendu côté serveur : il arrive en
   `children` et traverse ce composant sans être hydraté.
   ============================================================ */

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

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AdminSidebar
        pathname={pathname}
        role={role}
        open={navOpen}
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
        />
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 pb-16 pt-7 md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
