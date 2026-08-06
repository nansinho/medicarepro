import {
  SUGGEST_MIN_DIGITS,
  extractEtablissement,
  isValidSiren,
  rankSuggestions,
  sirenCandidates,
  sirenSubstitutionFixes,
  sirenTranspositionFixes,
  siretCandidates,
  suggestionsFrom,
  type SiretLookupResult,
  type SiretSuggestion,
} from "./siret";

/* ============================================================
   Annuaire des entreprises (recherche-entreprises.api.gouv.fr) —
   accès serveur mutualisé : cache, cadence, déduplication.

   POURQUOI TOUT PASSE PAR ICI. L'annuaire de l'État est gratuit et
   sans clé, mais plafonné à 7 requêtes par seconde PAR ADRESSE IP :
   celle de notre serveur, partagée par tous les praticiens en train
   de s'inscrire. Le guidage de saisie interroge jusqu'à dix numéros
   d'un coup ; sans régulateur, deux inscriptions simultanées
   suffiraient à se faire jeter (429) et le tunnel se mettrait à
   mentir. D'où, dans ce module et nulle part ailleurs :

   - un cache mémoire (l'annuaire bouge de mois en mois, pas de
     seconde en seconde) qui rend gratuits les chiffres suivants ;
   - une file à cadence fixe vers l'amont ;
   - une déduplication des requêtes identiques déjà en vol.

   FAIL-OPEN sur la panne, FAIL-CLOSED sur la réponse. Une panne de
   l'annuaire ne doit jamais fermer le tunnel (`unavailable`), mais
   une réponse claire « ce numéro n'existe pas » est bloquante : c'est
   elle qui filtre les inscriptions fantaisistes.
   ============================================================ */

const SEARCH_URL = "https://recherche-entreprises.api.gouv.fr/search";

/** Cadence sortante. L'amont tolère 7 req/s, on s'arrête à 6. */
const MIN_INTERVAL_MS = 170;
/** Au-delà, la file est telle qu'il vaut mieux répondre « indisponible ». */
const MAX_QUEUE_WAIT_MS = 4_000;
const REQUEST_TIMEOUT_MS = 4_000;
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 3_000;

type CacheEntry = { expires: number; payload: unknown };
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown | null>>();

/** Prochain créneau de départ libre (horodatage). */
let nextSlot = 0;

/**
 * Attend son tour dans la file sortante. Le créneau est réservé de façon
 * atomique (aucun `await` entre la lecture et l'écriture) : deux appels
 * concurrents ne peuvent pas prendre le même.
 */
async function waitForSlot(): Promise<boolean> {
  const now = Date.now();
  const slot = Math.max(now, nextSlot);
  if (slot - now > MAX_QUEUE_WAIT_MS) return false;
  nextSlot = slot + MIN_INTERVAL_MS;
  const delay = slot - now;
  if (delay > 0) await new Promise((r) => setTimeout(r, delay));
  return true;
}

function cacheGet(key: string): unknown | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return hit.payload;
}

function cacheSet(key: string, payload: unknown): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    // Map conserve l'ordre d'insertion : la plus ancienne sort en premier.
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, payload });
}

/**
 * Une recherche annuaire. `null` = indisponible (panne, quota, délai),
 * jamais « rien trouvé » : cette distinction décide d'un blocage.
 */
async function search(params: Record<string, string>): Promise<unknown | null> {
  const query = new URLSearchParams({ ...params, minimal: "true" }).toString();

  const cached = cacheGet(query);
  if (cached !== undefined) return cached;

  const flying = inFlight.get(query);
  if (flying) return flying;

  const call = (async () => {
    if (!(await waitForSlot())) return null;
    try {
      const res = await fetch(`${SEARCH_URL}?${query}`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
        headers: { accept: "application/json" },
      });
      if (!res.ok) {
        console.warn(`[annuaire] HTTP ${res.status} sur ${query}`);
        return null;
      }
      const payload: unknown = await res.json();
      cacheSet(query, payload);
      return payload;
    } catch {
      console.warn("[annuaire] injoignable");
      return null;
    } finally {
      inFlight.delete(query);
    }
  })();

  inFlight.set(query, call);
  return call;
}

/** Résultats d'une réponse `/search`, quel que soit le mode. */
function resultsOf(payload: unknown): Array<Record<string, unknown>> {
  const results = (payload as { results?: unknown } | null)?.results;
  return Array.isArray(results) ? (results as Array<Record<string, unknown>>) : [];
}

/* ------------------------------------------------------------
   Vérification d'un SIRET complet — c'est le verdict qui autorise
   ou refuse l'inscription. Utilisé par le tunnel ET par la route
   d'inscription (contrôle d'autorité : le navigateur ne décide pas).
   ------------------------------------------------------------ */

export type SiretVerdict = {
  status: "active" | "closed" | "not_found" | "unavailable";
  data?: SiretLookupResult;
};

export async function verifySiret(siret: string): Promise<SiretVerdict> {
  const payload = await search({
    q: siret,
    page: "1",
    per_page: "1",
    include: "siege,matching_etablissements",
    limite_matching_etablissements: "25",
  });
  if (payload === null) return { status: "unavailable" };

  const data = extractEtablissement(payload, siret);
  if (!data.found) return { status: "not_found" };
  return { status: data.active === false ? "closed" : "active", data };
}

/* ------------------------------------------------------------
   Guidage de saisie : des propositions réelles, de plus en plus
   rares à mesure que les chiffres tombent.
   ------------------------------------------------------------ */

export type SuggestReply = {
  /** Préfixe interrogé, tel qu'il a été reçu. */
  prefix: string;
  status: "need_more" | "ok" | "unavailable";
  /** Chiffres restant à taper avant que des propositions soient possibles. */
  need?: number;
  items: SiretSuggestion[];
  /** Les propositions corrigent une faute de frappe, elles ne prolongent pas la saisie. */
  didYouMean?: boolean;
  /** Une partie de l'annuaire n'a pas répondu : la liste peut être incomplète. */
  partial?: boolean;
  /** L'entreprise a plus d'établissements que ce que l'annuaire nous en rend. */
  truncated?: boolean;
};

/** Interroge plusieurs numéros exacts et rend les établissements trouvés. */
async function lookupMany(
  numbers: string[],
  kind: "siren" | "siret",
): Promise<{ items: SiretSuggestion[]; partial: boolean }> {
  const replies = await Promise.all(
    numbers.map(async (value) => {
      const payload = await search({
        q: value,
        page: "1",
        per_page: "1",
        include: kind === "siren" ? "siege" : "siege,matching_etablissements",
        ...(kind === "siret" ? { limite_matching_etablissements: "25" } : {}),
      });
      if (payload === null) return null;
      /* On ne garde que l'unité légale RÉELLEMENT porteuse du numéro : la
         recherche plein texte peut aussi ramener une société dont le nom
         contient ces chiffres. */
      const siren = value.slice(0, 9);
      const match = resultsOf(payload).some((r) => r.siren === siren);
      if (!match) return [];
      return suggestionsFrom(payload).filter((s) =>
        kind === "siren" ? s.siret.startsWith(value) : s.siret === value,
      );
    }),
  );

  const items: SiretSuggestion[] = [];
  const seen = new Set<string>();
  let partial = false;
  for (const reply of replies) {
    if (reply === null) {
      partial = true;
      continue;
    }
    for (const item of reply) {
      if (!seen.has(item.siret)) {
        seen.add(item.siret);
        items.push(item);
      }
    }
  }
  return { items, partial };
}

/**
 * Une unité légale et son siège. Rend aussi sa raison sociale BRUTE :
 * c'est elle qui sert à retrouver ses autres établissements, et non le
 * libellé remis en casse pour l'affichage.
 */
async function fetchUnit(siren: string): Promise<{
  rawName: string;
  items: SiretSuggestion[];
  count: number;
} | null> {
  const payload = await search({
    q: siren,
    page: "1",
    per_page: "1",
    include: "siege",
  });
  if (payload === null) return null;
  const result = resultsOf(payload).find((r) => r.siren === siren);
  if (!result) return { rawName: "", items: [], count: 0 };
  const rawName =
    (typeof result.nom_complet === "string" && result.nom_complet) ||
    (typeof result.nom_raison_sociale === "string" &&
      result.nom_raison_sociale) ||
    "";
  const items = suggestionsFrom(payload).filter((s) =>
    s.siret.startsWith(siren),
  );
  return {
    rawName,
    items,
    count:
      typeof result.nombre_etablissements === "number"
        ? result.nombre_etablissements
        : items.length,
  };
}

/**
 * Corrections d'un SIREN fautif, cherchées dans l'annuaire.
 *
 * En deux temps pour ne pas dépenser dix-sept requêtes à chaque faute de
 * frappe : les substitutions d'abord (le cas courant), les inversions
 * seulement si les premières n'ont rien donné.
 */
async function lookupTypoFixes(
  siren: string,
): Promise<{ items: SiretSuggestion[]; partial: boolean }> {
  const premier = await lookupMany(sirenSubstitutionFixes(siren), "siren");
  if (premier.items.length > 0 || premier.partial) return premier;
  const second = await lookupMany(sirenTranspositionFixes(siren), "siren");
  return { items: second.items, partial: premier.partial || second.partial };
}

/** Établissements d'une entreprise, retrouvés par sa raison sociale. */
async function establishmentsOf(
  siren: string,
  name: string,
): Promise<SiretSuggestion[] | null> {
  if (!name.trim()) return null;
  const payload = await search({
    q: name,
    page: "1",
    per_page: "5",
    include: "siege,matching_etablissements",
    limite_matching_etablissements: "25",
  });
  if (payload === null) return null;
  const mine = suggestionsFrom(payload).filter((s) => s.siret.startsWith(siren));
  return mine.length > 0 ? mine : null;
}

/**
 * Propositions pour un début de SIRET (7 à 13 chiffres).
 *
 * Trois régimes, dictés par ce que l'arithmétique autorise :
 * - 7 à 9 chiffres : on énumère les SIREN possibles (dix, puis un) et on
 *   demande à l'annuaire lesquels existent ;
 * - 10 à 13 : l'entreprise est connue, on affine sur SES établissements ;
 * - clé de Luhn fausse : on propose les corrections plausibles.
 */
export async function suggestSiret(prefix: string): Promise<SuggestReply> {
  const digits = prefix.replace(/\D/g, "").slice(0, 14);

  if (digits.length < SUGGEST_MIN_DIGITS) {
    return {
      prefix: digits,
      status: "need_more",
      need: SUGGEST_MIN_DIGITS - digits.length,
      items: [],
    };
  }

  /* --- 7 à 9 chiffres : les SIREN candidats --- */
  if (digits.length <= 9) {
    const candidats = sirenCandidates(digits);
    if (candidats.length > 0) {
      const { items, partial } = await lookupMany(candidats, "siren");
      if (items.length === 0 && partial) {
        return { prefix: digits, status: "unavailable", items: [] };
      }
      return {
        prefix: digits,
        status: "ok",
        items: rankSuggestions(items).slice(0, 10),
        partial: partial || undefined,
      };
    }
    /* Neuf chiffres refusés par Luhn : le SIREN est fautif, pas incomplet.
       On propose les numéros valides à une frappe près. */
    const { items, partial } = await lookupTypoFixes(digits);
    if (items.length === 0 && partial) {
      return { prefix: digits, status: "unavailable", items: [] };
    }
    return {
      prefix: digits,
      status: "ok",
      items: rankSuggestions(items).slice(0, 10),
      didYouMean: true,
      partial: partial || undefined,
    };
  }

  /* --- 10 chiffres et plus : le SIREN est censé être complet --- */
  const siren = digits.slice(0, 9);
  if (!isValidSiren(siren)) {
    const { items, partial } = await lookupTypoFixes(siren);
    if (items.length === 0 && partial) {
      return { prefix: digits, status: "unavailable", items: [] };
    }
    return {
      prefix: digits,
      status: "ok",
      items: rankSuggestions(items).slice(0, 10),
      didYouMean: true,
      partial: partial || undefined,
    };
  }

  const unit = await fetchUnit(siren);
  if (unit === null) {
    return { prefix: digits, status: "unavailable", items: [] };
  }
  if (unit.items.length === 0) {
    return { prefix: digits, status: "ok", items: [] };
  }

  let etablissements = unit.items;
  let truncated = false;

  if (unit.count > 1) {
    const liste = await establishmentsOf(siren, unit.rawName);
    if (liste) {
      const fusion = new Map(liste.map((e) => [e.siret, e]));
      for (const s of unit.items) {
        if (!fusion.has(s.siret)) fusion.set(s.siret, s);
      }
      etablissements = [...fusion.values()];
    }
    truncated = etablissements.length < unit.count;
  }

  let matching = etablissements.filter((e) => e.siret.startsWith(digits));

  /* Aucun des établissements connus ne colle, mais nous n'avons peut-être
     pas toute la liste : à 12 ou 13 chiffres, les SIRET complets possibles
     se comptent (dix, puis un) et on va les vérifier un par un. */
  if (matching.length === 0 && truncated) {
    const candidats = siretCandidates(digits);
    if (candidats.length > 0) {
      const exacts = await lookupMany(candidats, "siret");
      matching = exacts.items;
    }
  }

  return {
    prefix: digits,
    status: "ok",
    items: rankSuggestions(matching).slice(0, 10),
    truncated: truncated && matching.length === 0 ? true : undefined,
  };
}
