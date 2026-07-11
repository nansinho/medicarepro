"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock, FileText, Grid, Info, Search } from "./icons";
import type { SearchEntry } from "@/lib/search/buildIndex";
import styles from "./SearchOverlay.module.css";

/* ============================================================
   Recherche plein site : panneau pleine largeur.
   L'index (GET /api/search-index) est téléchargé une seule fois
   (préchargeable au survol de la loupe) puis filtré localement :
   insensible aux accents/casse, tolérant aux fautes de frappe
   (distance d'édition 1) et au pluriel, tous les termes doivent
   correspondre (ET). Les dernières recherches sont mémorisées
   en localStorage.
   ============================================================ */

const KIND_LABEL: Record<SearchEntry["kind"], string> = {
  page: "Page",
  article: "Article",
  faq: "FAQ",
};

const KIND_ICON: Record<
  SearchEntry["kind"],
  (props: React.SVGProps<SVGSVGElement>) => ReactNode
> = {
  page: Grid,
  article: FileText,
  faq: Info,
};

/** Accès rapides affichés tant que le champ est vide. */
const QUICK_LINKS = [
  { label: "Fonctionnalités", href: "/fonctionnalites" },
  { label: "Bilans", href: "/bilans" },
  { label: "Tarifs", href: "/tarifs" },
  { label: "Sécurité", href: "/securite" },
  { label: "Contact", href: "/contact" },
];

const MAX_RESULTS = 8;

/* ------------------------------------------------------------
   Normalisation et correspondance
   ------------------------------------------------------------ */

/** Version comparable d'un caractère : minuscule, sans accent.
 *  1 point de code → 1 caractère, pour projeter les positions
 *  de correspondance sur la chaîne d'origine (surlignage). */
function foldChar(ch: string): string {
  return ch.normalize("NFD")[0].toLowerCase();
}

function foldText(s: string): string {
  return Array.from(s, foldChar).join("");
}

/** Mots uniques (≥ 3 caractères) d'un texte déjà normalisé. */
function extractWords(...texts: string[]): string[] {
  const words = new Set<string>();
  for (const text of texts) {
    for (const word of text.split(/[^a-z0-9]+/)) {
      if (word.length >= 3) words.add(word);
    }
  }
  return [...words];
}

/** Distance d'édition ≤ 1 (une substitution, insertion ou suppression). */
function within1(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length > b.length) return within1(b, a);
  if (b.length - a.length > 1) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return a.length === b.length
    ? a.slice(i + 1) === b.slice(i + 1) // substitution unique
    : a.slice(i) === b.slice(i + 1); // insertion unique dans b
}

type IndexedEntry = SearchEntry & {
  foldedTitle: string;
  foldedText: string;
  words: string[];
};

type Scored = {
  entry: IndexedEntry;
  score: number;
  /** Sous-chaînes effectivement trouvées (pour le surlignage). */
  titleTokens: string[];
  textTokens: string[];
};

function matchEntry(entry: IndexedEntry, terms: string[]): Scored | null {
  let score = 0;
  const titleTokens: string[] = [];
  const textTokens: string[] = [];

  for (const term of terms) {
    let matched = false;

    /* 1) Sous-chaîne exacte, puis variante sans pluriel (« semelles »
       trouve « semelle »). */
    const variants =
      term.length >= 4 && /[sx]$/.test(term) ? [term, term.slice(0, -1)] : [term];
    for (const variant of variants) {
      const inTitle = entry.foldedTitle.includes(variant);
      const inText = entry.foldedText.includes(variant);
      if (!inTitle && !inText) continue;
      matched = true;
      score += (inTitle ? 3 : 0) + (inText ? 1 : 0);
      if (inTitle) titleTokens.push(variant);
      if (inText) textTokens.push(variant);
      break;
    }

    /* 2) Faute de frappe : un mot de l'entrée à une édition près
       (« semmelles » trouve « semelles »). Pondéré un peu moins. */
    if (!matched && term.length >= 4) {
      for (const word of entry.words) {
        if (!within1(word, term)) continue;
        const inTitle = entry.foldedTitle.includes(word);
        const inText = entry.foldedText.includes(word);
        if (!inTitle && !inText) continue;
        matched = true;
        score += (inTitle ? 2 : 0) + (inText ? 0.5 : 0);
        if (inTitle) titleTokens.push(word);
        if (inText) textTokens.push(word);
        break;
      }
    }

    if (!matched) return null;
  }
  return { entry, score, titleTokens, textTokens };
}

/** Plages [début, fin) des occurrences des tokens, fusionnées. */
function tokenRanges(folded: string, tokens: string[]): [number, number][] {
  const ranges: [number, number][] = [];
  for (const token of new Set(tokens)) {
    let from = 0;
    for (;;) {
      const i = folded.indexOf(token, from);
      if (i === -1) break;
      ranges.push([i, i + token.length]);
      from = i + token.length;
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  return merged;
}

/** Texte avec les correspondances en <mark> (indices en points de code). */
function highlight(
  chars: string[],
  ranges: [number, number][],
  offset = 0,
): ReactNode[] {
  const out: ReactNode[] = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    const s = Math.max(0, start - offset);
    const e = Math.min(chars.length, end - offset);
    if (e <= 0 || s >= chars.length || s >= e) continue;
    if (s > cursor) out.push(chars.slice(cursor, s).join(""));
    out.push(<mark key={start}>{chars.slice(s, e).join("")}</mark>);
    cursor = e;
  }
  if (cursor < chars.length) out.push(chars.slice(cursor).join(""));
  return out;
}

/** Extrait de texte centré sur la première correspondance. */
function snippet(entry: IndexedEntry, tokens: string[]): ReactNode {
  const chars = Array.from(entry.text);
  const ranges = tokenRanges(entry.foldedText, tokens);
  if (ranges.length === 0) return chars.slice(0, 130).join("");
  const start = Math.max(0, ranges[0][0] - 40);
  const end = Math.min(chars.length, start + 150);
  const window = chars.slice(start, end);
  const inWindow = ranges.filter(([s]) => s >= start && s < end);
  return (
    <>
      {start > 0 && "… "}
      {highlight(window, inWindow, start)}
      {end < chars.length && " …"}
    </>
  );
}

/* ------------------------------------------------------------
   Index partagé (préchargeable avant l'ouverture)
   ------------------------------------------------------------ */

let indexPromise: Promise<IndexedEntry[]> | null = null;

function loadIndex(): Promise<IndexedEntry[]> {
  indexPromise ??= fetch("/api/search-index")
    .then((res) =>
      res.ok ? res.json() : Promise.reject(new Error(String(res.status))),
    )
    .then((data: { entries: SearchEntry[] }) =>
      data.entries.map((entry) => {
        const foldedTitle = foldText(entry.title);
        const foldedText = foldText(entry.text);
        return {
          ...entry,
          foldedTitle,
          foldedText,
          words: extractWords(foldedTitle, foldedText),
        };
      }),
    )
    .catch((err) => {
      indexPromise = null; // permet de retenter à la prochaine ouverture
      throw err;
    });
  return indexPromise;
}

/** À appeler au survol/focus de la loupe : zéro latence à l'ouverture. */
export function prefetchSearchIndex(): void {
  loadIndex().catch(() => {});
}

/* ------------------------------------------------------------
   Recherches récentes (localStorage, partagé entre onglets)
   ------------------------------------------------------------ */

const RECENT_KEY = "medicarepro-recent-searches";
const RECENT_EVENT = "medicarepro:recents";

function subscribeRecents(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(RECENT_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(RECENT_EVENT, onChange);
  };
}

function readRecentsRaw(): string {
  try {
    return localStorage.getItem(RECENT_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function parseRecents(raw: string): string[] {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value)
      ? value.filter((q): q is string => typeof q === "string")
      : [];
  } catch {
    return [];
  }
}

function saveRecent(query: string): void {
  const q = query.trim();
  if (q.length < 2) return;
  try {
    const next = [
      q,
      ...parseRecents(readRecentsRaw()).filter(
        (prev) => foldText(prev) !== foldText(q),
      ),
    ].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(RECENT_EVENT));
  } catch {
    /* stockage indisponible (navigation privée) : tant pis */
  }
}

function clearRecents(): void {
  try {
    localStorage.removeItem(RECENT_KEY);
    window.dispatchEvent(new Event(RECENT_EVENT));
  } catch {
    /* idem */
  }
}

/* ------------------------------------------------------------
   Composant
   ------------------------------------------------------------ */

export default function SearchOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState<IndexedEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const recentsRaw = useSyncExternalStore(
    subscribeRecents,
    readRecentsRaw,
    () => "[]",
  );
  const recents = useMemo(() => parseRecents(recentsRaw), [recentsRaw]);

  /* À chaque réouverture, repartir d'un champ vide : c'est l'historique
     qui permet de reprendre une recherche (ajustement pendant le rendu,
     cf. « adjusting state when props change » des docs React). */
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setActive(0);
    }
  }

  /* Index chargé à l'ouverture (instantané s'il a été préchargé). */
  useEffect(() => {
    if (!open || index) return;
    let cancelled = false;
    loadIndex()
      .then((entries) => {
        if (cancelled) return;
        setIndex(entries);
        setFailed(false);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [open, index]);

  /* Focus, verrou du scroll et fermeture à Échap. */
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    inputRef.current?.select();
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const terms = useMemo(
    () => foldText(query).split(/\s+/).filter((t) => t.length >= 2),
    [query],
  );

  const results = useMemo(() => {
    if (!index || terms.length === 0) return [];
    return index
      .map((entry) => matchEntry(entry, terms))
      .filter((m): m is Scored => m !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS);
  }, [index, terms]);

  /* Sélection bornée à la liste courante (remise à 0 dans onChange). */
  const activeIdx = Math.min(active, Math.max(results.length - 1, 0));

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${activeIdx}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const go = (url: string) => {
    saveRecent(query);
    onClose();
    router.push(url);
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(activeIdx + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(activeIdx - 1, 0));
    } else if (e.key === "Enter" && results[activeIdx]) {
      e.preventDefault();
      go(results[activeIdx].entry.url);
    }
  };

  const rerun = (q: string) => {
    setQuery(q);
    setActive(0);
    inputRef.current?.focus();
  };

  const showEmpty =
    terms.length > 0 && index !== null && results.length === 0;

  return (
    <>
      <div
        className={`${styles.backdrop} ${open ? styles.open : ""}`}
        onClick={onClose}
      />
      <div
        className={`${styles.sheet} ${open ? styles.open : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Rechercher sur le site"
      >
        <span className={styles.halo} aria-hidden />
        <div className={`wrap ${styles.inner}`}>
          <div className={styles.inputRow}>
            <span className={styles.searchChip}>
              <Search width={18} height={18} />
            </span>
            <input
              ref={inputRef}
              className={styles.input}
              type="text"
              placeholder="Rechercher une page, un article, une question…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onInputKey}
              aria-label="Rechercher"
            />
            <button className={styles.escBtn} onClick={onClose}>
              Esc
            </button>
          </div>

          {terms.length === 0 && !failed && (
            <div className={styles.quick}>
              {recents.length > 0 && (
                <div className={styles.recentBlock}>
                  <p className={styles.quickLabel}>
                    Recherches récentes
                    <button
                      className={styles.recentClear}
                      onClick={clearRecents}
                    >
                      Effacer
                    </button>
                  </p>
                  <div className={styles.quickChips}>
                    {recents.map((q) => (
                      <button
                        key={q}
                        className={`${styles.chip} ${styles.recentChip}`}
                        onClick={() => rerun(q)}
                      >
                        <Clock width={14} height={14} />
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <p className={styles.quickLabel}>Accès rapide</p>
              <div className={styles.quickChips}>
                {QUICK_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={styles.chip}
                    onClick={onClose}
                  >
                    {link.label}
                    <ArrowRight width={13} height={13} />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {(terms.length > 0 || failed) && (
            <div className={styles.results} ref={listRef}>
              {failed && index === null && (
                <p className={styles.hint}>
                  La recherche est momentanément indisponible.
                </p>
              )}
              {!failed && index === null && (
                <p className={styles.hint}>Chargement…</p>
              )}
              {showEmpty && (
                <p className={styles.hint}>
                  Aucun résultat pour «&nbsp;{query.trim()}&nbsp;»
                </p>
              )}
              {results.map(({ entry, titleTokens, textTokens }, i) => {
                const KindIcon = KIND_ICON[entry.kind];
                return (
                  <Link
                    key={`${entry.url}-${entry.title}`}
                    href={entry.url}
                    data-index={i}
                    className={`${styles.result} ${
                      i === activeIdx ? styles.active : ""
                    }`}
                    onClick={() => {
                      saveRecent(query);
                      onClose();
                    }}
                    onMouseMove={() => setActive(i)}
                  >
                    <span className={styles.kindChip}>
                      <KindIcon width={17} height={17} />
                    </span>
                    <span className={styles.resultBody}>
                      <span className={styles.resultTitle}>
                        {highlight(
                          Array.from(entry.title),
                          tokenRanges(entry.foldedTitle, titleTokens),
                        )}
                      </span>
                      <span className={styles.resultText}>
                        {snippet(entry, textTokens)}
                      </span>
                    </span>
                    <span className={styles.resultMeta}>
                      <span className={styles.resultKind}>
                        {KIND_LABEL[entry.kind]}
                      </span>
                      <ArrowRight
                        className={styles.resultArrow}
                        width={16}
                        height={16}
                      />
                    </span>
                  </Link>
                );
              })}
            </div>
          )}

          <div className={styles.footer}>
            <span>
              <kbd>↑</kbd>
              <kbd>↓</kbd> naviguer
            </span>
            <span>
              <kbd>Entrée</kbd> ouvrir
            </span>
            <span>
              <kbd>Échap</kbd> fermer
            </span>
            <span className={styles.footerBrand}>
              <kbd>Ctrl</kbd>
              <kbd>K</kbd> pour ouvrir la recherche
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
