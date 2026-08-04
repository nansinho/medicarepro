"use client";

import { useCallback, useSyncExternalStore } from "react";

/* ============================================================
   Thème du back office — sélecteur EXPLICITE.

   Deux modes seulement, clair par défaut. Suivre prefers-color-scheme
   a été écarté : une démonstration en soirée ouvrait en sombre sans
   que personne l'ait demandé.

   La classe est posée sur #admin-scope, JAMAIS sur <html> : la vitrine
   est claire uniquement et ne doit pas pouvoir être atteinte.

   La source de vérité est le DOM (la classe), pas un état React : c'est
   le script inline du layout qui l'écrit AVANT la première peinture,
   sinon on verrait un flash clair à chaque rechargement en mode sombre.
   React s'y abonne donc via useSyncExternalStore plutôt que de la
   recopier dans un effet.
   ============================================================ */

export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "admin_theme_mode";
const SCOPE_ID = "admin-scope";

/** Script à injecter avant peinture, dans chaque racine `.admin-scope`. */
export const ADMIN_THEME_BOOT = `try{if(localStorage.getItem(${JSON.stringify(
  STORAGE_KEY,
)})==="dark"){document.getElementById(${JSON.stringify(
  SCOPE_ID,
)}).classList.add("dark")}}catch(e){}`;

function scope(): HTMLElement | null {
  return document.getElementById(SCOPE_ID);
}

function getSnapshot(): ThemeMode {
  return scope()?.classList.contains("dark") ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  const el = scope();
  if (!el) return () => {};
  const observer = new MutationObserver(onChange);
  observer.observe(el, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

export function AdminThemeProvider({ children }: { children: React.ReactNode }) {
  /* Plus de contexte : la classe DOM EST l'état partagé, et chaque
     consommateur s'y abonne directement. Un fournisseur n'apporterait
     qu'une indirection de plus. */
  return <>{children}</>;
}

export function useAdminTheme(): {
  mode: ThemeMode;
  setMode: (next: ThemeMode) => void;
  toggle: () => void;
} {
  const mode = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => "light" as const,
  );

  const setMode = useCallback((next: ThemeMode) => {
    scope()?.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* navigation privée : la préférence ne survit pas à l'onglet. */
    }
  }, []);

  const toggle = useCallback(
    () => setMode(getSnapshot() === "dark" ? "light" : "dark"),
    [setMode],
  );

  return { mode, setMode, toggle };
}
