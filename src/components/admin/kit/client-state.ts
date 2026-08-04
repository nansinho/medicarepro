"use client";

import { useCallback, useSyncExternalStore } from "react";

/* ============================================================
   Deux petits utilitaires d'état client, écrits avec
   useSyncExternalStore plutôt qu'avec un setState dans un effet.

   Ce n'est pas une coquetterie : un setState dans un effet déclenche
   un rendu en cascade après l'hydratation, et c'est précisément ce que
   la règle react-hooks/set-state-in-effect signale. useSyncExternalStore
   donne en plus la bonne valeur au serveur (instantané serveur explicite),
   donc pas de divergence d'hydratation.
   ============================================================ */

/** `true` une fois monté côté client. Sert aux portails (document requis). */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

type Listener = () => void;

/**
 * Valeur booléenne persistée dans localStorage, partagée par tous les
 * abonnés. Le cache module évite de relire le stockage à chaque rendu
 * (getSnapshot doit renvoyer une valeur stable, sinon React boucle).
 */
export function createPersistedFlag(key: string, fallback = false) {
  let cache: boolean | null = null;
  const listeners = new Set<Listener>();

  function read(): boolean {
    if (cache === null) {
      try {
        const raw = localStorage.getItem(key);
        cache = raw === null ? fallback : raw === "1";
      } catch {
        cache = fallback;
      }
    }
    return cache;
  }

  function write(next: boolean) {
    cache = next;
    try {
      localStorage.setItem(key, next ? "1" : "0");
    } catch {
      /* navigation privée : la préférence ne survit pas à l'onglet. */
    }
    listeners.forEach((l) => l());
  }

  function subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return { read, write, subscribe, serverValue: () => fallback };
}

export function usePersistedFlag(
  flag: ReturnType<typeof createPersistedFlag>,
): [boolean, (next: boolean) => void] {
  const value = useSyncExternalStore(
    flag.subscribe,
    flag.read,
    flag.serverValue,
  );
  const set = useCallback((next: boolean) => flag.write(next), [flag]);
  return [value, set];
}
