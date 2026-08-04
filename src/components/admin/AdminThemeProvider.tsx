"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

/* ============================================================
   Thème du back office — sélecteur EXPLICITE.

   Deux modes seulement, clair par défaut. Suivre prefers-color-scheme
   a été écarté : une démonstration en soirée ouvrait en sombre sans
   que personne l'ait demandé.

   La classe est posée sur #admin-scope, JAMAIS sur <html> : la vitrine
   est claire uniquement et ne doit pas pouvoir être atteinte.

   L'application avant peinture est faite par le script inline du layout
   (voir ADMIN_THEME_BOOT) ; ce fournisseur ne fait que LIRE l'état posé
   au démarrage, sinon il écraserait la préférence et rendrait le flash
   inévitable.
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

type Ctx = { mode: ThemeMode; setMode: (next: ThemeMode) => void; toggle: () => void };

const ThemeContext = createContext<Ctx | null>(null);

export function AdminThemeProvider({ children }: { children: React.ReactNode }) {
  /* Départ à "light" pour que le rendu serveur et la première passe client
     concordent ; l'état réel est relu de la classe dans l'effet ci-dessous. */
  const [mode, setModeState] = useState<ThemeMode>("light");

  useEffect(() => {
    const scope = document.getElementById(SCOPE_ID);
    setModeState(scope?.classList.contains("dark") ? "dark" : "light");
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    document.getElementById(SCOPE_ID)?.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* navigation privée : la préférence ne survit pas à l'onglet, tant pis. */
    }
  }, []);

  const toggle = useCallback(
    () => setMode(mode === "dark" ? "light" : "dark"),
    [mode, setMode],
  );

  return (
    <ThemeContext.Provider value={{ mode, setMode, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAdminTheme(): Ctx {
  const ctx = useContext(ThemeContext);
  /* Repli inerte : les écrans d'authentification montent le Toaster sans
     fournisseur, ils n'ont pas de sélecteur de thème. */
  return ctx ?? { mode: "light", setMode: () => {}, toggle: () => {} };
}
