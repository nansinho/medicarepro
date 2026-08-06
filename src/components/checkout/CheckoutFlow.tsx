"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Script from "next/script";
import { friendlyFormatIBAN, isValidIBAN } from "ibantools";
import {
  CabinetSchema,
  UserSchema,
  SepaSchema,
  CheckoutSchema,
} from "@/lib/checkout/schema";
import {
  splitSiretMatch,
  SUGGEST_MIN_DIGITS,
  type SiretSuggestion,
} from "@/lib/checkout/siret";
import type { BillingPlan } from "@/lib/checkout/pricing";
import {
  PRICING_VERSION,
  MAX_EXTRA_COLLABORATORS,
  checkoutAmountCents,
  instalmentAmountsCents,
  instalmentsAvailable,
  formatEuros,
} from "@/lib/checkout/pricing";
import { LEGAL_DOCUMENTS } from "@/lib/legal/registry";
import { mandateText } from "@/lib/sepa/mandate-text";
import { maskIban } from "@/lib/sepa/iban";
import PasswordStrength from "@/components/auth/PasswordStrength";
import MoneticoRedirectForm from "./MoneticoRedirectForm";
import StripeRedirect from "./StripeRedirect";
import PdfViewer, { type PdfDoc } from "./PdfViewer";
import s from "./Checkout.module.css";

/* ============================================================
   Tunnel d'inscription — formulaire 6 étapes :
   1. Formule (plan + collaborateurs)   2. Cabinet (SIRET d'abord,
      auto-remplissage annuaire des entreprises)
   3. Administrateur                    4. Mandat SEPA
   5. Documents contractuels (case unique art. 5 CGV)
   6. Récapitulatif + Turnstile → POST /api/checkout
   → auto-post du formulaire Monetico (paiement carte).
   Chaque étape est validée avec les sous-schémas Zod partagés
   avec la route serveur (validation d'autorité côté API).
   ============================================================ */

/** Table de prix pré-calculée côté serveur (index = nb de collaborateurs). */
export type PriceRow = { monthlyLabel: string; totalLabel: string };
export type PriceTable = Record<BillingPlan, PriceRow[]>;

type Props = {
  initialPlan: BillingPlan;
  monthlyEnabled: boolean;
  annualEnabled: boolean;
  siteKey?: string;
  /** Identifiant Créancier SEPA — figure sur tous les mandats (donnée publique du créancier). */
  sepaIcs: string;
  /** Étape « Mandat SEPA » active ? Coupée → tunnel à 5 étapes, aucun mandat. */
  sepaEnabled: boolean;
  prices: PriceTable;
  /* --- Ce que le tunnel PROMET, et qui dépend de qui encaisse. Ce sont des
     engagements contractuels affichés juste avant le paiement : le navigateur
     ne doit pas les deviner, le serveur les lui dit. --- */
  /** L'offre 12 mois se reconduit-elle ? Vrai chez Stripe, faux chez Monetico. */
  annualRenews: boolean;
  /** Le prestataire nommé au client (« Stripe », « Monetico — CIC »). */
  payBrand: string;
  /** Peut-il résilier depuis son espace, ou doit-il nous écrire ? */
  selfServiceCancel: boolean;
};

/* ---- Cloudflare Turnstile (rendu explicite) ---- */
type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/* Étapes du tunnel identifiées par CLÉ stable (pas par index) : l'étape
   « sepa » peut être absente (mandat SEPA coupé), donc tous les index sont
   dérivés à l'exécution du tableau réellement affiché — aucun décalage
   possible entre les 5 et 6 étapes. */
type StepKey = "formule" | "cabinet" | "admin" | "sepa" | "documents" | "recap";

const STEP_LABELS: Record<StepKey, string> = {
  formule: "Formule",
  cabinet: "Cabinet",
  admin: "Administrateur",
  sepa: "Mandat SEPA",
  documents: "Documents",
  recap: "Récapitulatif",
};

/** Ordre des étapes selon que le mandat SEPA est actif ou non. */
function stepKeysFor(sepaEnabled: boolean): StepKey[] {
  return [
    "formule",
    "cabinet",
    "admin",
    ...(sepaEnabled ? (["sepa"] as StepKey[]) : []),
    "documents",
    "recap",
  ];
}

/* Repris de la grille tarifaire, jamais recopié : le serveur applique CETTE
   valeur, et un écart ferait refuser au dernier moment un effectif que le
   compteur venait d'autoriser. */
const MAX_COLLABS = MAX_EXTRA_COLLABORATORS;

const PLAN_LABEL: Record<BillingPlan, string> = {
  MONTHLY: "Mensuel sans engagement",
  ANNUAL: "Offre 12 mois",
};

/** Clé d'étape qui porte une erreur donnée (l'index concret est résolu ensuite). */
function stepKeyForErrorKey(key: string): StepKey {
  if (key.startsWith("cabinet.")) return "cabinet";
  if (key.startsWith("user.")) return "admin";
  if (key.startsWith("sepa.") || key === "mandateAccepted") return "sepa";
  if (key === "termsAccepted") return "documents";
  if (key === "plan" || key === "extraCollaborators") return "formule";
  return "recap"; // turnstileToken, website…
}

/** JSON d'une réponse d'erreur, sans jeter si le corps n'est pas du JSON. */
async function safeJson(res: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/* ---- Petites icônes inline (cohérentes avec le reste du site) ---- */
function IconEye({ off }: { off?: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {off ? (
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </>
      ) : (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

function IconAlert() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

/* ---- Champ texte générique (label + input + erreur) ---- */
type FieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  /** Confirmation en vert sous le champ, quand il n'y a pas d'erreur. */
  okMessage?: string;
  optional?: boolean;
  type?: string;
  autoComplete?: string;
  inputMode?: "text" | "email" | "tel" | "numeric";
  placeholder?: string;
  maxLength?: number;
  className?: string;
  onBlur?: () => void;
};

function Field({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  okMessage,
  optional,
  type = "text",
  autoComplete,
  inputMode,
  placeholder,
  maxLength,
  className,
  onBlur,
}: FieldProps) {
  return (
    <div className={`${s.field} ${className ?? ""}`}>
      <label className={s.label} htmlFor={id}>
        {label}
        {optional && <span className={s.optional}> (facultatif)</span>}
      </label>
      <input
        id={id}
        className={`${s.input} ${error ? s.inputInvalid : ""}`}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
      />
      {okMessage && !error && (
        <p className={s.ibanOk} id={`${id}-ok`}>
          ✓ {okMessage}
        </p>
      )}
      {hint && !error && !okMessage && (
        <p className={s.hint} id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className={s.fieldError} id={`${id}-err`}>
          <IconAlert /> {error}
        </p>
      )}
    </div>
  );
}

export default function CheckoutFlow({
  initialPlan,
  monthlyEnabled,
  annualEnabled,
  siteKey,
  sepaIcs,
  sepaEnabled,
  prices,
  annualRenews,
  payBrand,
  selfServiceCancel,
}: Props) {
  /* Étapes réellement affichées (clés + libellés) et helpers d'index —
     tout est dérivé de sepaEnabled, aucun index en dur ailleurs. */
  const stepKeys = useMemo(() => stepKeysFor(sepaEnabled), [sepaEnabled]);
  const STEPS = useMemo(
    () => stepKeys.map((k) => STEP_LABELS[k]),
    [stepKeys],
  );
  const indexOfStep = (k: StepKey) => stepKeys.indexOf(k);

  /* ---- État du dossier ---- */
  const [step, setStep] = useState(0);
  const [plan, setPlan] = useState<BillingPlan>(initialPlan);
  const [extra, setExtra] = useState(0);
  /* Règlement de l'offre 12 mois en trois versements. Réinitialisé dès qu'on
     repasse au mensuel : laisser le choix actif produirait un récapitulatif
     annonçant des versements sur une formule qui n'en accepte pas. */
  const [instalments, setInstalments] = useState(false);
  const [cabinet, setCabinet] = useState({
    name: "",
    email: "",
    phone: "",
    mobilePhone: "",
    address: "",
    city: "",
    postalCode: "",
    siretNumber: "",
    rppsNumber: "",
  });
  const [user, setUser] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });
  const [passwordConfirm, setPasswordConfirm] = useState("");
  /** Le champ a-t-il été quitté ? On ne contredit personne pendant sa frappe. */
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [sepa, setSepa] = useState({ iban: "", bic: "", accountHolder: "" });
  const [ibanTouched, setIbanTouched] = useState(false);
  const [mandateAccepted, setMandateAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot — reste vide chez un humain

  /* ---- SIRET : verdict sur le numéro complet (14 chiffres) ----
     « found » et « error » ne se ressemblent pas : le premier ouvre la
     porte, le second (annuaire injoignable) la laisse ouverte faute de
     savoir. Seuls « not_found » et « closed » arrêtent l'inscription. */
  const [siretLookup, setSiretLookup] = useState<{
    status: "idle" | "loading" | "found" | "closed" | "not_found" | "error";
    name?: string;
  }>({ status: "idle" });

  /* ---- SIRET : guidage de saisie (7 chiffres et plus) ----
     On ne garde ici que la DERNIÈRE RÉPONSE DU SERVEUR, telle quelle. Les
     chiffres suivants ne peuvent que rétrécir cette liste : ils la filtrent
     au rendu, sans rien redemander ni rien stocker de plus. Une saisie
     complète coûte ainsi une poignée d'appels, pas un par frappe. */
  const [siretSuggest, setSiretSuggest] = useState<{
    status: "idle" | "loading" | "ok" | "unavailable";
    /** Préfixe auquel `items` répond. */
    prefix: string;
    items: SiretSuggestion[];
    didYouMean?: boolean;
    truncated?: boolean;
  }>({ status: "idle", prefix: "", items: [] });
  const [siretOpen, setSiretOpen] = useState(false);
  const [siretActive, setSiretActive] = useState(-1);
  /* Le même contenu, lisible depuis l'effet sans le relancer. */
  const siretCache = useRef<{
    prefix: string;
    items: SiretSuggestion[];
    didYouMean: boolean;
  } | null>(null);

  /* ---- État technique ---- */
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [redirect, setRedirect] = useState<{
    action: string;
    fields: Record<string, string>;
  } | null>(null);
  /** Adresse de la page Stripe, une fois la caisse ouverte. */
  const [stripeUrl, setStripeUrl] = useState<string | null>(null);
  /** Document contractuel en cours de lecture, le cas échéant. */
  const [pdf, setPdf] = useState<PdfDoc | null>(null);

  /* ---- Turnstile ---- */
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReady, setTurnstileReady] = useState(false);
  /* Le script n'est jamais arrivé : on le DIT, au lieu de laisser un cadre vide
     sous un message qui réclame une validation impossible. */
  const [turnstileBloque, setTurnstileBloque] = useState(false);
  const turnstileHost = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetId = useRef<string | null>(null);

  const cardTitleRef = useRef<HTMLHeadingElement | null>(null);
  const firstRender = useRef(true);

  const row = prices[plan][extra];
  /* Le même découpage que le serveur, au centime près : le reste de la division
     tombe sur le premier versement. Ce n'est qu'un affichage — les montants
     réellement facturés sont recalculés côté serveur — mais un écart d'un
     centime entre l'écran et le débit est exactement ce qui fait écrire un
     praticien. */
  const echelonnable = instalmentsAvailable(plan);
  const versements =
    echelonnable && instalments
      ? instalmentAmountsCents(checkoutAmountCents(plan, extra))
      : [];
  const ibanValid = isValidIBAN(sepa.iban);

  /* Focus + remontée en haut de carte à chaque changement d'étape. */
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    cardTitleRef.current?.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  /* Revalidation LIVE : dès que des erreurs sont affichées sur l'étape
     courante, on les recalcule à chaque frappe et on retire celles qui
     sont corrigées — sinon un message rouge (« SIRET : 14 chiffres »,
     « Téléphone portable requis »…) resterait figé après correction.
     On ne fait apparaître aucune NOUVELLE erreur ici (pas de rouge tant
     qu'on n'a pas cliqué « Continuer ») : on ne fait qu'en effacer. */
  useEffect(() => {
    setErrors((prev) => {
      const shown = Object.keys(prev);
      if (shown.length === 0) return prev;
      const stillInvalid = validateStep(step);
      let changed = false;
      const next: Record<string, string> = {};
      for (const key of shown) {
        if (stillInvalid[key]) {
          next[key] = prev[key]; // toujours invalide → on garde le message
        } else {
          changed = true; // corrigé → on retire
        }
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cabinet,
    user,
    passwordConfirm,
    sepa,
    mandateAccepted,
    termsAccepted,
    /* Le verdict SIRET arrive APRÈS la frappe : sans lui dans les
       dépendances, « Vérification en cours » resterait affiché en rouge
       une fois l'établissement confirmé. */
    siretLookup.status,
  ]);

  /* SIRET complet (14 chiffres) → VERDICT de l'annuaire des entreprises, et
     pré-remplissage des champs ENCORE VIDES uniquement (on n'écrase jamais
     une saisie). Le verdict conditionne le passage à l'étape suivante ;
     l'annuaire injoignable ne bloque personne (statut « error »). */
  useEffect(() => {
    const siret = cabinet.siretNumber;
    if (siret.length !== 14) {
      setSiretLookup({ status: "idle" });
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSiretLookup({ status: "loading" });
      try {
        const res = await fetch(`/api/checkout/siret?siret=${siret}`, {
          signal: controller.signal,
          credentials: "same-origin",
        });
        if (!res.ok) {
          setSiretLookup({ status: res.status === 422 ? "not_found" : "error" });
          return;
        }
        const data = (await res.json()) as {
          status?: string;
          found: boolean;
          name?: string;
          address?: string;
          postalCode?: string;
          city?: string;
          active?: boolean;
        };
        if (data.status === "unavailable") {
          setSiretLookup({ status: "error" });
          return;
        }
        if (!data.found) {
          setSiretLookup({ status: "not_found" });
          return;
        }
        setCabinet((p) => ({
          ...p,
          name: p.name.trim() === "" && data.name ? data.name : p.name,
          address:
            p.address.trim() === "" && data.address ? data.address : p.address,
          postalCode:
            p.postalCode.trim() === "" && data.postalCode
              ? data.postalCode
              : p.postalCode,
          city: p.city.trim() === "" && data.city ? data.city : p.city,
        }));
        setSiretLookup({
          status: data.active === false ? "closed" : "found",
          name: data.name,
        });
      } catch {
        if (!controller.signal.aborted) setSiretLookup({ status: "error" });
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [cabinet.siretNumber]);

  /* GUIDAGE DE SAISIE. À partir du 7ᵉ chiffre, l'annuaire ne rend plus des
     hypothèses mais des établissements réels, et leur nombre fond à chaque
     frappe : dix, puis un, puis les établissements de l'entreprise (voir
     `lib/checkout/annuaire.ts` pour la mécanique).

     Le rétrécissement se fait D'ABORD dans le navigateur : les chiffres
     suivants ne peuvent que réduire une liste déjà connue. On ne redemande
     au serveur que lorsqu'elle se vide, c'est-à-dire quand on change
     vraiment de question. */
  useEffect(() => {
    const prefix = cabinet.siretNumber;
    /* Rien à demander : trop court pour que la question ait un sens, ou
       déjà complet (c'est alors le verdict qui parle, plus la liste). */
    if (prefix.length < SUGGEST_MIN_DIGITS || prefix.length >= 14) return;

    /* Déjà répondu : la liste en main contient encore ce préfixe, le rendu
       n'a qu'à la filtrer. C'est ce qui rend les chiffres suivants gratuits. */
    const vu = siretCache.current;
    if (vu) {
      if (vu.didYouMean && vu.prefix === prefix) return;
      if (
        !vu.didYouMean &&
        prefix.startsWith(vu.prefix) &&
        vu.items.some((i) => i.siret.startsWith(prefix))
      ) {
        return;
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSiretSuggest((p) => ({ ...p, status: "loading" }));
      try {
        const res = await fetch(
          `/api/checkout/siret/suggest?prefix=${prefix}`,
          { signal: controller.signal, credentials: "same-origin" },
        );
        if (!res.ok) {
          siretCache.current = null;
          setSiretSuggest({ status: "unavailable", prefix, items: [] });
          return;
        }
        const data = (await res.json()) as {
          status?: string;
          items?: SiretSuggestion[];
          didYouMean?: boolean;
          truncated?: boolean;
        };
        if (data.status === "unavailable") {
          siretCache.current = null;
          setSiretSuggest({ status: "unavailable", prefix, items: [] });
          return;
        }
        const items = Array.isArray(data.items) ? data.items : [];
        siretCache.current = {
          prefix,
          items,
          didYouMean: data.didYouMean === true,
        };
        setSiretSuggest({
          status: "ok",
          prefix,
          items,
          didYouMean: data.didYouMean,
          truncated: data.truncated,
        });
      } catch {
        if (!controller.signal.aborted) {
          siretCache.current = null;
          setSiretSuggest({ status: "unavailable", prefix, items: [] });
        }
      }
    }, 260);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [cabinet.siretNumber]);

  /* Pré-remplit le titulaire du compte avec le nom du cabinet à l'arrivée sur l'étape SEPA. */
  useEffect(() => {
    if (sepaEnabled && stepKeys[step] === "sepa") {
      setSepa((p) =>
        p.accountHolder.trim() === "" ? { ...p, accountHolder: cabinet.name } : p,
      );
    }
  }, [step, cabinet.name, sepaEnabled, stepKeys]);

  /* DESSINE LE WIDGET DÈS QUE L'API EXISTE, sans attendre qu'on nous le dise.

     Le rendu dépendait du `onReady` de `next/script`. Ce signal n'arrive pas
     toujours : script déjà en cache, exécution différée par Safari, ou
     navigation interne qui remonte le composant après le chargement. Dans ces
     cas le widget n'était JAMAIS dessiné — un cadre vide, aucune erreur, et un
     praticien coincé sur « Merci de valider la vérification anti-robot » sans
     rien à cliquer. Constaté en production sur Safari le 06/08/2026.

     On observe donc directement `window.turnstile`, ce qui couvre le script
     déjà chargé comme celui qui arrive. Au bout de dix secondes on abandonne :
     le blocage est alors réel (extension, réseau d'entreprise), et l'écran doit
     le dire plutôt que de tourner indéfiniment. */
  useEffect(() => {
    if (stepKeys[step] !== "recap" || !siteKey) return;

    let arrete = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const limite = Date.now() + 10_000;

    const essayer = () => {
      if (arrete || turnstileWidgetId.current !== null) return;
      const api = window.turnstile;
      const host = turnstileHost.current;
      if (api && host) {
        turnstileWidgetId.current = api.render(host, {
          sitekey: siteKey,
          callback: (token: string) => setTurnstileToken(token),
          "expired-callback": () => setTurnstileToken(""),
          "error-callback": () => setTurnstileToken(""),
        });
        return;
      }
      if (Date.now() > limite) {
        setTurnstileBloque(true);
        return;
      }
      timer = setTimeout(essayer, 150);
    };
    essayer();

    return () => {
      arrete = true;
      if (timer) clearTimeout(timer);
      if (turnstileWidgetId.current !== null) {
        try {
          window.turnstile?.remove(turnstileWidgetId.current);
        } catch {
          /* widget déjà retiré du DOM */
        }
        turnstileWidgetId.current = null;
        setTurnstileToken("");
      }
    };
  }, [step, siteKey, stepKeys]);

  function resetTurnstile() {
    if (turnstileWidgetId.current !== null) {
      try {
        window.turnstile?.reset(turnstileWidgetId.current);
      } catch {
        /* ignore */
      }
    }
    setTurnstileToken("");
  }

  /* ---- Texte du mandat, recalculé avec les saisies ---- */
  const mandate = useMemo(
    () =>
      mandateText({
        rum: "attribué à la validation",
        ics: sepaIcs,
        debtorName: cabinet.name || "—",
        accountHolder: sepa.accountHolder || cabinet.name || "—",
        debtorAddress:
          [cabinet.address, `${cabinet.postalCode} ${cabinet.city}`.trim()]
            .filter(Boolean)
            .join(", ") || "—",
        ibanMasked: ibanValid ? maskIban(sepa.iban) : "—",
      }),
    [sepaIcs, cabinet, sepa.accountHolder, sepa.iban, ibanValid],
  );

  /* ---- Choix d'un établissement proposé ----
     On écrase ici les coordonnées, contrairement au pré-remplissage
     automatique : désigner son établissement dans la liste est un geste
     délibéré, et c'est l'adresse officielle qui doit figurer sur les
     factures. Ce qui manque à l'annuaire ne détruit rien. */
  function pickSiret(item: SiretSuggestion) {
    setCabinet((p) => ({
      ...p,
      siretNumber: item.siret,
      name: item.name || p.name,
      address: item.address ?? p.address,
      postalCode: item.postalCode ?? p.postalCode,
      city: item.city ?? p.city,
    }));
    siretCache.current = null;
    setSiretOpen(false);
    setSiretActive(-1);
  }

  /* Navigation clavier de la liste (motif combobox ARIA) : la souris n'est
     pas la seule façon de choisir, et le champ garde le focus tout du long. */
  function onSiretKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const items = siretItems;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (items.length === 0) return;
      event.preventDefault();
      setSiretOpen(true);
      setSiretActive((i) => {
        const suivant = event.key === "ArrowDown" ? i + 1 : i - 1;
        if (suivant < 0) return items.length - 1;
        if (suivant >= items.length) return 0;
        return suivant;
      });
      return;
    }
    if (event.key === "Enter" && siretOpen && items[siretActive]) {
      event.preventDefault(); // sinon la touche valide l'étape au passage
      pickSiret(items[siretActive]);
      return;
    }
    if (event.key === "Escape" && siretOpen) {
      event.preventDefault();
      setSiretOpen(false);
      setSiretActive(-1);
    }
  }

  /* CE QUI EST RÉELLEMENT PROPOSÉ À L'ÉCRAN : la dernière réponse du serveur,
     rétrécie aux chiffres tapés depuis. Dérivé à chaque rendu plutôt que
     stocké : la liste ne peut donc jamais rester en retard d'une frappe. */
  const siretDigits = cabinet.siretNumber;
  const siretItems = useMemo(() => {
    if (siretDigits.length < SUGGEST_MIN_DIGITS || siretDigits.length >= 14) {
      return [];
    }
    const { prefix, items, didYouMean } = siretSuggest;
    if (items.length === 0) return items;
    // Une correction de faute ne vaut que pour le numéro exact qui l'a produite.
    if (didYouMean) return prefix === siretDigits ? items : [];
    if (!siretDigits.startsWith(prefix)) return [];
    return items.filter((i) => i.siret.startsWith(siretDigits));
  }, [siretSuggest, siretDigits]);

  /** Chiffres restant à taper avant que des propositions soient possibles. */
  const siretNeed =
    siretDigits.length > 0 && siretDigits.length < SUGGEST_MIN_DIGITS
      ? SUGGEST_MIN_DIGITS - siretDigits.length
      : 0;

  /* La liste ne s'affiche que si elle a quelque chose à proposer : un cadre
     vide sous le champ ne renseignerait personne. */
  const listeSiretOuverte = siretOpen && siretItems.length > 0;

  /* ---- Validation par étape (identifiée par sa CLÉ, pas son index) ---- */
  function validateStep(index: number): Record<string, string> {
    const errs: Record<string, string> = {};
    const key = stepKeys[index];
    if (key === "cabinet") {
      const parsed = CabinetSchema.safeParse(cabinet);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const k = `cabinet.${issue.path.join(".")}`;
          if (!errs[k]) errs[k] = issue.message;
        }
      }
      /* LE SIRET DOIT ÊTRE CONFIRMÉ PAR L'ANNUAIRE pour passer l'étape.
         Le même contrôle est refait à la soumission côté serveur (c'est
         lui qui fait foi) : ici on épargne au praticien de saisir tout
         son dossier avant d'apprendre que le numéro ne va pas.
         L'annuaire injoignable (« error ») ne retient personne. */
      if (!errs["cabinet.siretNumber"]) {
        if (siretLookup.status === "loading") {
          errs["cabinet.siretNumber"] =
            "Vérification du SIRET en cours, un instant.";
        } else if (siretLookup.status === "not_found") {
          errs["cabinet.siretNumber"] =
            "Ce SIRET est introuvable au répertoire officiel des entreprises.";
        } else if (siretLookup.status === "closed") {
          errs["cabinet.siretNumber"] =
            "Cet établissement est déclaré fermé au répertoire officiel.";
        }
      }
    } else if (key === "admin") {
      const parsed = UserSchema.safeParse(user);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const k = `user.${issue.path.join(".")}`;
          if (!errs[k]) errs[k] = issue.message;
        }
      }
      if (user.password !== passwordConfirm) {
        errs["user.passwordConfirm"] = "Les deux mots de passe ne correspondent pas";
      }
    } else if (key === "sepa") {
      const parsed = SepaSchema.safeParse(sepa);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const k = `sepa.${issue.path.join(".")}`;
          if (!errs[k]) errs[k] = issue.message;
        }
      }
      if (!mandateAccepted) {
        errs["mandateAccepted"] = "Vous devez accepter le mandat de prélèvement";
      }
    } else if (key === "documents") {
      if (!termsAccepted) {
        errs["termsAccepted"] =
          "Vous devez accepter les conditions contractuelles";
      }
    }
    return errs;
  }

  function goNext() {
    const errs = validateStep(step);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setBanner(null);
    setStep((v) => Math.min(v + 1, STEPS.length - 1));
  }

  function goBack() {
    setErrors({});
    setBanner(null);
    setStep((v) => Math.max(v - 1, 0));
  }

  function goTo(index: number) {
    if (index < step) {
      setErrors({});
      setBanner(null);
      setStep(index);
    }
  }

  /* ---- Erreurs renvoyées par le serveur (422) → champs + étape concernée ---- */
  function applyServerIssues(data: Record<string, unknown> | null): boolean {
    const issues = data?.issues;
    const errs: Record<string, string> = {};
    if (Array.isArray(issues)) {
      // Forme zod .issues : [{ path: [...], message }]
      for (const issue of issues as { path?: (string | number)[]; message?: string }[]) {
        if (issue?.path && issue.path.length > 0) {
          const key = issue.path.join(".");
          if (!errs[key]) errs[key] = issue.message ?? "Champ invalide";
        }
      }
    } else if (issues && typeof issues === "object") {
      // Forme zod .flatten() : { fieldErrors: { champ: [messages] } }
      const fieldErrors = (issues as { fieldErrors?: Record<string, unknown> })
        .fieldErrors;
      if (fieldErrors) {
        for (const [key, value] of Object.entries(fieldErrors)) {
          const message = Array.isArray(value) ? value[0] : value;
          if (typeof message === "string") errs[key] = message;
        }
      }
    }
    if (Object.keys(errs).length === 0) return false;
    setErrors(errs);
    setStep(firstStepWithErrors(errs));
    return true;
  }

  /** Index de la 1re étape affichée portant une des erreurs (clés → index réels). */
  function firstStepWithErrors(errs: Record<string, string>): number {
    const indices = Object.keys(errs)
      .map((k) => indexOfStep(stepKeyForErrorKey(k)))
      .filter((i) => i >= 0);
    return indices.length > 0 ? Math.min(...indices) : step;
  }

  /* ---- Soumission finale → POST /api/checkout ---- */
  async function submit() {
    // Filet de sécurité : la case contractuelle se coche à l'étape Documents.
    if (!termsAccepted) {
      setErrors({
        termsAccepted: "Vous devez accepter les conditions contractuelles",
      });
      setStep(indexOfStep("documents"));
      return;
    }
    if (!turnstileToken) {
      setErrors({
        turnstileToken: "Merci de valider la vérification anti-robot",
      });
      return;
    }

    // Quand le mandat SEPA est coupé, on n'envoie ni IBAN ni acceptation
    // de mandat — le serveur (autorité) applique le même flag d'env.
    const parsed = CheckoutSchema.safeParse({
      plan,
      extraCollaborators: extra,
      instalments: echelonnable && instalments,
      cabinet,
      user,
      ...(sepaEnabled ? { sepa, mandateAccepted } : {}),
      termsAccepted,
      turnstileToken,
      website,
    });
    if (!parsed.success) {
      const localErrs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        if (!localErrs[key]) localErrs[key] = issue.message;
      }
      setErrors(localErrs);
      setStep(firstStepWithErrors(localErrs));
      return;
    }

    setSubmitting(true);
    setBanner(null);
    setErrors({});
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          /* Stripe : une adresse où envoyer le client. */
          redirectUrl?: string;
          /* Monetico : un formulaire scellé à auto-soumettre. */
          action?: string;
          fields?: Record<string, string>;
        };
        if (data.redirectUrl) {
          /* On remplace tout l'écran AVANT de partir. Naviguer sans changer
             d'écran laissait le bouton de paiement réactivé par le `finally`
             pendant que Stripe chargeait : un client qui re-clique ouvre un
             second dossier, avec une seconde référence et un préfixe de
             facturation consommé pour rien. */
          setStripeUrl(data.redirectUrl);
          return;
        }
        if (data.action && data.fields) {
          setRedirect({ action: data.action, fields: data.fields });
          return;
        }
        /* Ni l'un ni l'autre : le dossier existe mais la caisse n'a pas ouvert.
           Le dire, plutôt que de laisser un bouton tourner indéfiniment. */
        resetTurnstile();
        setBanner(
          "Le paiement n'a pas pu être ouvert. Réessayez dans quelques instants.",
        );
        return;
      }

      // Un jeton Turnstile est à usage unique : on le régénère après tout échec.
      resetTurnstile();
      const data = await safeJson(res);

      if (res.status === 422) {
        applyServerIssues(data);
        setBanner(
          typeof data?.error === "string"
            ? data.error
            : "Certains champs sont invalides. Vérifiez votre saisie.",
        );
      } else if (res.status === 409) {
        setBanner(
          typeof data?.error === "string"
            ? data.error
            : "Impossible de finaliser l'inscription avec ces informations. Vérifiez votre saisie ou contactez-nous à contact@medicarepro.fr.",
        );
      } else if (res.status === 429) {
        setBanner(
          typeof data?.error === "string"
            ? data.error
            : "Trop de tentatives. Réessayez dans une heure.",
        );
      } else if (res.status === 502 || res.status === 503) {
        setBanner(
          "Le service d'inscription est momentanément indisponible. Réessayez dans quelques instants — aucune somme n'a été débitée.",
        );
      } else if (res.status === 403) {
        setBanner("Requête refusée. Rechargez la page puis réessayez.");
      } else {
        setBanner("Une erreur inattendue est survenue. Réessayez.");
      }
    } catch {
      resetTurnstile();
      setBanner(
        "Impossible de contacter le serveur. Vérifiez votre connexion puis réessayez.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  /* ---- Départ vers Stripe : on remplace tout le tunnel ---- */
  if (stripeUrl) {
    return (
      <div className={s.shell}>
        <StripeRedirect url={stripeUrl} />
      </div>
    );
  }

  /* ---- Redirection Monetico : on remplace tout le tunnel ---- */
  if (redirect) {
    return (
      <div className={s.shell}>
        <MoneticoRedirectForm action={redirect.action} fields={redirect.fields} />
      </div>
    );
  }

  const cardTitles: Record<StepKey, { title: string; desc: string }> = {
    formule: {
      title: "Choisissez votre formule",
      desc: "Sans frais d'installation. Résiliable selon les CGV.",
    },
    cabinet: {
      title: "Votre cabinet",
      desc: "Ces informations figureront sur vos factures.",
    },
    admin: {
      title: "Compte administrateur",
      desc: "Le praticien titulaire — il gérera le cabinet dans MediCare Pro.",
    },
    sepa: {
      title: "Mandat de prélèvement SEPA",
      desc: "Pour le renouvellement automatique de votre abonnement. Aucun prélèvement sans prénotification par email.",
    },
    documents: {
      title: "Documents contractuels",
      desc: "Les documents qui encadrent votre abonnement — consultables et téléchargeables à tout moment.",
    },
    recap: {
      title: "Récapitulatif",
      desc: "Vérifiez votre dossier avant de procéder au paiement.",
    },
  };
  const currentCard = cardTitles[stepKeys[step]];

  return (
    <div className={s.shell}>
      {/* Lecture d'un document contractuel, par-dessus le tunnel : l'état du
          formulaire reste intact derrière. */}
      {pdf && <PdfViewer doc={pdf} onClose={() => setPdf(null)} />}

      {/* Script Turnstile — rendu explicite pour maîtriser le cycle de vie du widget. */}
      {siteKey && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onReady={() => setTurnstileReady(true)}
        />
      )}

      <div className={s.head}>
        <h1 className={s.title}>Créer votre espace MediCare Pro</h1>
        <p className={s.subtitle}>
          5 minutes suffisent — votre cabinet est opérationnel dès le paiement
          validé.
        </p>
      </div>

      {/* Stepper */}
      <nav className={s.steps} aria-label="Étapes de l'inscription">
        <ol className={s.stepsInner}>
          {STEPS.map((label, i) => (
            <li key={label} className={s.stepItem}>
              {i > 0 && (
                <span
                  className={`${s.bar} ${i <= step ? s.barActive : ""}`}
                  aria-hidden="true"
                />
              )}
              <button
                type="button"
                className={`${s.stepBtn} ${i < step ? s.stepBtnPast : ""}`}
                onClick={() => goTo(i)}
                disabled={i >= step}
                aria-current={i === step ? "step" : undefined}
                aria-label={`Étape ${i + 1} sur ${STEPS.length} : ${label}`}
              >
                <span
                  className={`${s.dot} ${
                    i === step ? s.dotActive : i < step ? s.dotDone : ""
                  }`}
                >
                  {i < step ? "✓" : i + 1}
                </span>
                <span
                  className={`${s.stepLabel} ${i === step ? s.stepLabelActive : ""}`}
                >
                  {label}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className={s.card}>
        <div className={s.cardHead}>
          <h2 className={s.cardTitle} ref={cardTitleRef} tabIndex={-1}>
            {currentCard.title}
          </h2>
          <p className={s.cardDesc}>{currentCard.desc}</p>
        </div>

        <div className={s.cardBody}>
          {banner && (
            <div className={s.banner} role="alert" style={{ marginBottom: 18 }}>
              <IconAlert /> <span>{banner}</span>
            </div>
          )}

          {/* ================= Étape 1 — Formule ================= */}
          {step === 0 && (
            <div className={s.sectionGap}>
              <div className={s.planGrid}>
                <button
                  type="button"
                  className={`${s.planCard} ${
                    plan === "ANNUAL" ? s.planCardActive : ""
                  } ${!annualEnabled ? s.planCardDisabled : ""}`}
                  onClick={() => annualEnabled && setPlan("ANNUAL")}
                  disabled={!annualEnabled}
                  aria-pressed={plan === "ANNUAL"}
                >
                  {annualEnabled ? (
                    <span className={s.planBadge}>2 mois offerts</span>
                  ) : (
                    <span className={s.planSoon}>Bientôt disponible</span>
                  )}
                  <div className={s.planName}>Offre 12 mois</div>
                  <div className={s.planPrice}>
                    {prices.ANNUAL[0].monthlyLabel}
                    <span className={s.planPriceUnit}> TTC/mois</span>
                  </div>
                  <div className={s.planDesc}>
                    {annualEnabled
                      ? `Facturé ${prices.ANNUAL[0].totalLabel} par an, en une fois.`
                      : "Cette formule ouvrira prochainement."}
                  </div>
                </button>

                <button
                  type="button"
                  className={`${s.planCard} ${
                    plan === "MONTHLY" ? s.planCardActive : ""
                  } ${!monthlyEnabled ? s.planCardDisabled : ""}`}
                  onClick={() => monthlyEnabled && setPlan("MONTHLY")}
                  disabled={!monthlyEnabled}
                  aria-pressed={plan === "MONTHLY"}
                >
                  {!monthlyEnabled && (
                    <span className={s.planSoon}>Bientôt disponible</span>
                  )}
                  <div className={s.planName}>Mensuel sans engagement</div>
                  <div className={s.planPrice}>
                    {prices.MONTHLY[0].monthlyLabel}
                    <span className={s.planPriceUnit}> TTC/mois</span>
                  </div>
                  <div className={s.planDesc}>
                    {monthlyEnabled
                      ? "Sans engagement, résiliable à tout moment."
                      : "Cette formule ouvrira prochainement."}
                  </div>
                </button>
              </div>

              <div className={s.collab}>
                <div className={s.collabHead}>
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  Collaborateurs supplémentaires
                </div>
                <p className={s.collabDesc}>
                  Praticiens en plus du titulaire — 15,00&nbsp;€ TTC/mois
                  chacun. Modifiable plus tard.
                </p>
                <div className={s.counter}>
                  <button
                    type="button"
                    className={s.counterBtn}
                    onClick={() => setExtra((v) => Math.max(0, v - 1))}
                    disabled={extra === 0}
                    aria-label="Retirer un collaborateur"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    className={s.counterVal}
                    value={extra}
                    min={0}
                    max={MAX_COLLABS}
                    onChange={(e) => {
                      /* Champ vidé pendant la frappe : on retombe à 0 plutôt
                         que sur NaN, qui ferait disparaître le prix affiché. */
                      const n = Number.parseInt(e.target.value, 10);
                      if (Number.isNaN(n)) return setExtra(0);
                      setExtra(Math.max(0, Math.min(MAX_COLLABS, n)));
                    }}
                    aria-label="Nombre de collaborateurs supplémentaires"
                  />
                  <button
                    type="button"
                    className={s.counterBtn}
                    onClick={() => setExtra((v) => Math.min(MAX_COLLABS, v + 1))}
                    disabled={extra === MAX_COLLABS}
                    aria-label="Ajouter un collaborateur"
                  >
                    +
                  </button>
                </div>
                <div className={s.collabCalc}>
                  <span>
                    Mensualité&nbsp;:{" "}
                    <span className={s.accent}>{row.monthlyLabel} TTC/mois</span>
                  </span>
                  <span className={s.collabTotal}>
                    Facturé aujourd&apos;hui&nbsp;:{" "}
                    {versements.length > 0
                      ? `${formatEuros(versements[0])} TTC (1er versement)`
                      : `${row.totalLabel} TTC ${plan === "ANNUAL" ? "(12 mois)" : "(1er mois)"}`}
                  </span>
                </div>
              </div>

              {/* ---- Règlement en trois fois — offre 12 mois uniquement ----

                  N'apparaît QUE sur l'annuelle : le mensuel est déjà un
                  étalement, et proposer d'y découper 29,88 € en trois n'aurait
                  aucun sens.

                  Le calendrier est écrit en clair, montants et rangs compris.
                  C'est la seule chose qui distingue un étalement d'une mauvaise
                  surprise : un praticien qui découvre un second prélèvement un
                  mois plus tard conteste auprès de sa banque, et une
                  contestation coûte plus cher que le versement. */}
              {echelonnable && (
                <div className={s.collab}>
                  <label className={s.instalmentToggle}>
                    <input
                      type="checkbox"
                      checked={instalments}
                      onChange={(e) => setInstalments(e.target.checked)}
                    />
                    <span>
                      <b>Régler en 3 fois, sans frais</b>
                      <span className={s.instalmentHint}>
                        Trois versements mensuels au lieu d&apos;un paiement
                        unique. Votre accès est ouvert pour 12 mois dès le
                        premier.
                      </span>
                    </span>
                  </label>

                  {versements.length > 0 && (
                    <ol className={s.instalmentPlan}>
                      {versements.map((montant, i) => (
                        <li key={i}>
                          <span>
                            {i === 0
                              ? "Aujourd'hui"
                              : `Dans ${i} mois`}
                          </span>
                          <b>{formatEuros(montant)} TTC</b>
                        </li>
                      ))}
                      <li className={s.instalmentTotal}>
                        <span>Total, sans supplément</span>
                        <b>{row.totalLabel} TTC</b>
                      </li>
                    </ol>
                  )}
                </div>
              )}

              <div className={s.alert}>
                <IconAlert />
                {sepaEnabled ? (
                  <span>
                    Le premier règlement s&apos;effectue par carte bancaire
                    (Monetico&nbsp;— CIC). Les renouvellements seront prélevés
                    par mandat SEPA, mis en place à l&apos;étape suivante.
                  </span>
                ) : plan === "ANNUAL" && !annualRenews ? (
                  /* Offre 12 mois CHEZ MONETICO : paiement unique par le TPE
                     immédiat, aucune reconduction possible. */
                  <span>
                    Le règlement s&apos;effectue par carte bancaire ({payBrand}
                    ). L&apos;offre 12 mois est un{" "}
                    <b>paiement unique de {row.totalLabel} TTC</b>{" "}
                    qui vous donne accès pendant 12 mois, <b>sans reconduction
                    automatique</b>. Nous vous préviendrons par email avant
                    l&apos;échéance pour renouveler si vous le souhaitez.
                  </span>
                ) : (
                  /* Reconduction tacite — montant, périodicité et modalités
                     d'arrêt connus du client AVANT le paiement. Chez Stripe,
                     l'annuelle se reconduit comme la mensuelle : annoncer
                     l'inverse serait faux sur le point qui engage le plus. */
                  <span>
                    Le règlement s&apos;effectue par carte bancaire ({payBrand}
                    ). Votre abonnement est ensuite{" "}
                    <b>
                      reconduit automatiquement chaque{" "}
                      {plan === "ANNUAL" ? "année" : "mois"}
                    </b>{" "}
                    pour {row.totalLabel} TTC, sur la même carte, jusqu&apos;à ce
                    que vous y mettiez fin.{" "}
                    {selfServiceCancel ? (
                      <>
                        Vous pouvez l&apos;arrêter à tout moment depuis votre
                        espace abonnement
                      </>
                    ) : (
                      <>
                        Vous pouvez arrêter la reconduction à tout moment en nous
                        écrivant à{" "}
                        <a href="mailto:contact@medicarepro.fr">
                          contact@medicarepro.fr
                        </a>
                      </>
                    )}
                    &nbsp;: votre accès reste ouvert jusqu&apos;au terme de la
                    période déjà réglée.
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ================= Étape 2 — Cabinet ================= */}
          {stepKeys[step] === "cabinet" && (
            <div className={s.grid2}>
              {/* SIRET en premier (exigence client) : il pré-remplit le
                  reste du formulaire depuis l'annuaire des entreprises. */}
              <div className={`${s.field} ${s.col2}`}>
                <label className={s.label} htmlFor="cab-siret">
                  SIRET
                </label>
                <div className={s.siretBox}>
                  <input
                    id="cab-siret"
                    className={`${s.input} ${
                      errors["cabinet.siretNumber"] ? s.inputInvalid : ""
                    }`}
                    type="text"
                    value={cabinet.siretNumber}
                    onChange={(e) => {
                      setSiretOpen(true);
                      setSiretActive(-1); // la ligne surlignée ne survit pas à une frappe
                      setCabinet((p) => ({
                        ...p,
                        siretNumber: e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 14),
                      }));
                    }}
                    onKeyDown={onSiretKeyDown}
                    onFocus={() => setSiretOpen(true)}
                    onBlur={() => setSiretOpen(false)}
                    inputMode="numeric"
                    placeholder="Tapez les premiers chiffres"
                    maxLength={14}
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={listeSiretOuverte}
                    aria-controls="cab-siret-list"
                    aria-autocomplete="list"
                    aria-activedescendant={
                      listeSiretOuverte && siretActive >= 0
                        ? `cab-siret-opt-${siretActive}`
                        : undefined
                    }
                    aria-invalid={errors["cabinet.siretNumber"] ? true : undefined}
                    aria-describedby="cab-siret-live"
                  />
                  {listeSiretOuverte && (
                    <ul
                      className={s.siretList}
                      id="cab-siret-list"
                      role="listbox"
                      aria-label="Établissements correspondant à votre saisie"
                    >
                      {siretSuggest.didYouMean && (
                        <li className={s.siretListHead} role="presentation">
                          Ce numéro ne peut pas exister. Vouliez-vous dire :
                        </li>
                      )}
                      {siretItems.map((item, i) => {
                        const [tape, reste] = splitSiretMatch(
                          item.siret,
                          siretSuggest.didYouMean ? 0 : cabinet.siretNumber.length,
                        );
                        return (
                          <li
                            key={item.siret}
                            id={`cab-siret-opt-${i}`}
                            role="option"
                            aria-selected={i === siretActive}
                            className={`${s.siretOption} ${
                              i === siretActive ? s.siretOptionActive : ""
                            }`}
                            /* Le clic ne doit pas voler le focus au champ,
                               sinon `onBlur` referme la liste avant que le
                               choix ne soit enregistré. */
                            onMouseDown={(e) => e.preventDefault()}
                            onMouseEnter={() => setSiretActive(i)}
                            onClick={() => pickSiret(item)}
                          >
                            <span className={s.siretOptionTop}>
                              <span className={s.siretOptionName}>
                                {item.name}
                              </span>
                              {item.health && (
                                <em className={s.siretTag}>Santé</em>
                              )}
                              {item.establishmentCount > 1 &&
                                item.headquarters && (
                                  <em className={s.siretTag}>Siège</em>
                                )}
                              {!item.active && (
                                <em className={`${s.siretTag} ${s.siretTagOff}`}>
                                  Fermé
                                </em>
                              )}
                            </span>
                            <span className={s.siretOptionMeta}>
                              <span className={s.siretNum}>
                                <b>{tape}</b>
                                {reste}
                              </span>
                              {(item.postalCode || item.city) && (
                                <span className={s.siretCity}>
                                  {[item.postalCode, item.city]
                                    .filter(Boolean)
                                    .join(" ")}
                                </span>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {/* Une seule ligne d'état à la fois, annoncée aux lecteurs
                    d'écran : c'est elle qui dit combien d'établissements
                    restent possibles, puis si le numéro est confirmé. */}
                <div id="cab-siret-live" className={s.siretStatus} aria-live="polite">
                  {errors["cabinet.siretNumber"] ? (
                    <p className={s.fieldError}>
                      <IconAlert /> {errors["cabinet.siretNumber"]}
                    </p>
                  ) : siretLookup.status === "loading" ? (
                    <p className={s.hint}>
                      Vérification auprès de l&apos;annuaire des entreprises…
                    </p>
                  ) : siretLookup.status === "found" ? (
                    <p className={s.ibanOk}>
                      ✓ {siretLookup.name ?? "Établissement confirmé"}. Vos
                      coordonnées sont pré-remplies ci-dessous, vérifiez-les.
                    </p>
                  ) : siretLookup.status === "closed" ? (
                    <p className={s.fieldError}>
                      <IconAlert /> Cet établissement est déclaré fermé au
                      répertoire officiel des entreprises.
                    </p>
                  ) : siretLookup.status === "not_found" ? (
                    <p className={s.fieldError}>
                      <IconAlert /> Ce SIRET est introuvable au répertoire
                      officiel des entreprises.
                    </p>
                  ) : siretLookup.status === "error" ? (
                    <p className={s.hint}>
                      Annuaire momentanément indisponible. Votre numéro sera
                      vérifié à la validation du dossier.
                    </p>
                  ) : siretNeed > 0 ? (
                    <p className={s.hint}>
                      Encore {siretNeed} chiffre{siretNeed > 1 ? "s" : ""} et
                      nous vous proposons votre établissement.
                    </p>
                  ) : siretSuggest.status === "loading" ? (
                    <p className={s.hint}>Recherche des établissements possibles…</p>
                  ) : siretSuggest.status === "unavailable" ? (
                    <p className={s.hint}>
                      Annuaire momentanément indisponible. Saisissez vos 14
                      chiffres, nous vérifierons ensuite.
                    </p>
                  ) : siretItems.length > 0 ? (
                    <p className={s.hint}>
                      {siretItems.length} établissement
                      {siretItems.length > 1 ? "s" : ""} possible
                      {siretItems.length > 1 ? "s" : ""}
                      {siretSuggest.didYouMean
                        ? " après correction"
                        : ""}. Choisissez le vôtre dans la liste, ou continuez à
                      taper.
                    </p>
                  ) : siretSuggest.status === "ok" && siretSuggest.truncated ? (
                    <p className={s.hint}>
                      Cette entreprise compte de nombreux établissements.
                      Continuez la saisie pour retrouver le vôtre.
                    </p>
                  ) : siretSuggest.status === "ok" ? (
                    <p className={s.hint}>
                      Aucun établissement connu ne porte ces chiffres. Vérifiez
                      votre saisie.
                    </p>
                  ) : (
                    <p className={s.hint}>
                      Tapez les premiers chiffres : nous retrouvons votre
                      établissement et remplissons vos coordonnées.
                    </p>
                  )}

                  {/* La porte de secours. Un établissement immatriculé depuis
                      quelques jours, ou dont le dirigeant a demandé la
                      non-diffusion, est absent de l'annuaire public sans rien
                      avoir à se reprocher. */}
                  {(siretLookup.status === "not_found" ||
                    siretLookup.status === "closed") && (
                    <p className={s.hint}>
                      Votre numéro est pourtant exact ? Un établissement tout
                      juste immatriculé, ou non diffusible à sa demande,
                      n&apos;apparaît pas dans l&apos;annuaire public.{" "}
                      <a
                        className={s.siretHelp}
                        href={`mailto:contact@medicarepro.fr?subject=${encodeURIComponent(
                          "Vérification de mon SIRET",
                        )}&body=${encodeURIComponent(
                          `Bonjour,\n\nMon SIRET ${cabinet.siretNumber} n'est pas reconnu lors de l'inscription. Pouvez-vous vérifier et ouvrir mon accès ?\n\nCabinet : \nTéléphone : \n`,
                        )}`}
                      >
                        Écrivez-nous
                      </a>
                      , nous vérifions et ouvrons votre accès.
                    </p>
                  )}
                </div>
              </div>
              <Field
                id="cab-name"
                label="Nom du cabinet"
                value={cabinet.name}
                onChange={(v) => setCabinet((p) => ({ ...p, name: v }))}
                error={errors["cabinet.name"]}
                autoComplete="organization"
                placeholder="Cabinet de podologie Dupont"
                maxLength={200}
                className={s.col2}
              />
              <Field
                id="cab-email"
                label="Email du cabinet"
                type="email"
                value={cabinet.email}
                onChange={(v) => setCabinet((p) => ({ ...p, email: v }))}
                error={errors["cabinet.email"]}
                autoComplete="email"
                inputMode="email"
                placeholder="cabinet@exemple.fr"
                maxLength={180}
              />
              {/* Le PORTABLE d'abord : c'est lui qui est obligatoire, et c'est
                  lui que l'application exige. Le fixe passait devant, sur la
                  même ligne que l'email, pendant que l'obligatoire se retrouvait
                  seul en dessous — l'œil lisait donc le facultatif comme le
                  champ principal. */}
              <Field
                id="cab-mobile"
                label="Téléphone portable"
                type="tel"
                value={cabinet.mobilePhone}
                onChange={(v) => setCabinet((p) => ({ ...p, mobilePhone: v }))}
                error={errors["cabinet.mobilePhone"]}
                autoComplete="tel"
                inputMode="tel"
                placeholder="06 00 00 00 00"
                maxLength={30}
              />
              <Field
                id="cab-phone"
                label="Téléphone fixe"
                optional
                type="tel"
                value={cabinet.phone}
                onChange={(v) => setCabinet((p) => ({ ...p, phone: v }))}
                error={errors["cabinet.phone"]}
                autoComplete="tel"
                inputMode="tel"
                placeholder="04 42 00 00 00"
                maxLength={30}
              />
              <Field
                id="cab-address"
                label="Adresse"
                value={cabinet.address}
                onChange={(v) => setCabinet((p) => ({ ...p, address: v }))}
                error={errors["cabinet.address"]}
                autoComplete="street-address"
                placeholder="12 rue de la République"
                maxLength={300}
                className={s.col2}
              />
              <Field
                id="cab-cp"
                label="Code postal"
                value={cabinet.postalCode}
                onChange={(v) =>
                  setCabinet((p) => ({
                    ...p,
                    postalCode: v.replace(/\D/g, "").slice(0, 5),
                  }))
                }
                error={errors["cabinet.postalCode"]}
                autoComplete="postal-code"
                inputMode="numeric"
                placeholder="13100"
                maxLength={5}
              />
              <Field
                id="cab-city"
                label="Ville"
                value={cabinet.city}
                onChange={(v) => setCabinet((p) => ({ ...p, city: v }))}
                error={errors["cabinet.city"]}
                autoComplete="address-level2"
                placeholder="Aix-en-Provence"
                maxLength={120}
              />
              <Field
                id="cab-rpps"
                label="Numéro RPPS"
                value={cabinet.rppsNumber}
                onChange={(v) =>
                  setCabinet((p) => ({
                    ...p,
                    rppsNumber: v.replace(/\D/g, "").slice(0, 11),
                  }))
                }
                error={errors["cabinet.rppsNumber"]}
                hint="11 chiffres, figurant sur votre carte CPS ou dans l'Annuaire Santé."
                inputMode="numeric"
                placeholder="11 chiffres"
                maxLength={11}
              />
            </div>
          )}

          {/* ================= Étape 3 — Administrateur ================= */}
          {stepKeys[step] === "admin" && (
            <div className={s.grid2}>
              <Field
                id="usr-firstname"
                label="Prénom"
                value={user.firstName}
                onChange={(v) => setUser((p) => ({ ...p, firstName: v }))}
                error={errors["user.firstName"]}
                autoComplete="given-name"
                maxLength={100}
              />
              <Field
                id="usr-lastname"
                label="Nom"
                value={user.lastName}
                onChange={(v) => setUser((p) => ({ ...p, lastName: v }))}
                error={errors["user.lastName"]}
                autoComplete="family-name"
                maxLength={100}
              />
              <Field
                id="usr-email"
                label="Email de connexion"
                type="email"
                value={user.email}
                onChange={(v) => setUser((p) => ({ ...p, email: v }))}
                error={errors["user.email"]}
                hint="Servira d'identifiant pour vous connecter à MediCare Pro."
                autoComplete="email"
                inputMode="email"
                placeholder="prenom.nom@exemple.fr"
                maxLength={180}
                className={s.col2}
              />

              <div className={`${s.field} ${s.col2}`}>
                <label className={s.label} htmlFor="usr-password">
                  Mot de passe
                </label>
                <div className={s.inputWrap}>
                  <input
                    id="usr-password"
                    className={`${s.input} ${
                      errors["user.password"] ? s.inputInvalid : ""
                    }`}
                    type={showPassword ? "text" : "password"}
                    value={user.password}
                    onChange={(e) =>
                      setUser((p) => ({ ...p, password: e.target.value }))
                    }
                    autoComplete="new-password"
                    maxLength={200}
                    aria-invalid={errors["user.password"] ? true : undefined}
                    aria-describedby={
                      errors["user.password"] ? "usr-password-err" : undefined
                    }
                  />
                  <button
                    type="button"
                    className={s.eyeBtn}
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={
                      showPassword
                        ? "Masquer le mot de passe"
                        : "Afficher le mot de passe"
                    }
                  >
                    <IconEye off={showPassword} />
                  </button>
                </div>
                {errors["user.password"] && (
                  <p className={s.fieldError} id="usr-password-err">
                    <IconAlert /> {errors["user.password"]}
                  </p>
                )}
                <PasswordStrength password={user.password} />
              </div>

              {/* La concordance se dit TOUT DE SUITE, comme pour l'IBAN et le
                  SIRET. Sans ça, le praticien ne savait qu'au clic sur
                  « Continuer » qu'il avait mal ressaisi — et il devait
                  retaper les deux champs sans savoir lequel était fautif.
                  Le vert dès que ça correspond, le rouge seulement après avoir
                  quitté le champ : personne ne veut être contredit pendant
                  qu'il tape. */}
              <Field
                id="usr-password2"
                label="Confirmez le mot de passe"
                type={showPassword ? "text" : "password"}
                value={passwordConfirm}
                onChange={setPasswordConfirm}
                onBlur={() => setConfirmTouched(true)}
                error={
                  errors["user.passwordConfirm"] ??
                  (confirmTouched &&
                  passwordConfirm.length > 0 &&
                  passwordConfirm !== user.password
                    ? "Les deux mots de passe ne correspondent pas"
                    : undefined)
                }
                okMessage={
                  passwordConfirm.length > 0 && passwordConfirm === user.password
                    ? "Les mots de passe correspondent"
                    : undefined
                }
                autoComplete="new-password"
                maxLength={200}
                className={s.col2}
              />
            </div>
          )}

          {/* ============= Étape 4 — Mandat SEPA (masquable) ============= */}
          {sepaEnabled && stepKeys[step] === "sepa" && (
            <div className={s.sectionGap}>
              <div className={s.alert}>
                <IconAlert />
                <span>
                  Ce mandat servira uniquement au renouvellement de votre
                  abonnement. Chaque prélèvement sera prénotifié par email au
                  moins 14&nbsp;jours à l&apos;avance. Aucun débit
                  aujourd&apos;hui&nbsp;: le premier règlement se fait par
                  carte.
                </span>
              </div>

              <div className={s.grid2}>
                <Field
                  id="sepa-holder"
                  label="Titulaire du compte"
                  value={sepa.accountHolder}
                  onChange={(v) => setSepa((p) => ({ ...p, accountHolder: v }))}
                  error={errors["sepa.accountHolder"]}
                  autoComplete="off"
                  maxLength={200}
                  className={s.col2}
                />
                <div className={`${s.field} ${s.col2}`}>
                  <label className={s.label} htmlFor="sepa-iban">
                    IBAN
                  </label>
                  <input
                    id="sepa-iban"
                    className={`${s.input} ${
                      errors["sepa.iban"] ? s.inputInvalid : ""
                    }`}
                    type="text"
                    value={friendlyFormatIBAN(sepa.iban) ?? sepa.iban}
                    onChange={(e) =>
                      setSepa((p) => ({
                        ...p,
                        iban: e.target.value
                          .replace(/[^0-9a-zA-Z]/g, "")
                          .toUpperCase()
                          .slice(0, 34),
                      }))
                    }
                    onBlur={() => setIbanTouched(true)}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="FR76 0000 0000 0000 0000 0000 000"
                    aria-invalid={errors["sepa.iban"] ? true : undefined}
                    aria-describedby={
                      errors["sepa.iban"] ? "sepa-iban-err" : "sepa-iban-live"
                    }
                  />
                  {/* Validation live (ibantools) */}
                  {errors["sepa.iban"] ? (
                    <p className={s.fieldError} id="sepa-iban-err">
                      <IconAlert /> {errors["sepa.iban"]}
                    </p>
                  ) : ibanValid ? (
                    <p className={s.ibanOk} id="sepa-iban-live">
                      ✓ IBAN valide
                    </p>
                  ) : ibanTouched && sepa.iban.length > 0 ? (
                    <p className={s.fieldError} id="sepa-iban-live">
                      <IconAlert /> IBAN incomplet ou invalide
                    </p>
                  ) : (
                    <p className={s.hint} id="sepa-iban-live">
                      Le compte qui sera prélevé au renouvellement.
                    </p>
                  )}
                </div>
                <Field
                  id="sepa-bic"
                  label="BIC"
                  optional
                  value={sepa.bic}
                  onChange={(v) =>
                    setSepa((p) => ({
                      ...p,
                      bic: v.replace(/[^0-9a-zA-Z]/g, "").toUpperCase().slice(0, 11),
                    }))
                  }
                  error={errors["sepa.bic"]}
                  autoComplete="off"
                  placeholder="CMCIFRPP"
                  maxLength={11}
                  className={s.col2}
                />
              </div>

              <div className={s.field}>
                <span className={s.label}>
                  Mandat de prélèvement SEPA (CORE)
                </span>
                <div
                  className={s.mandateBox}
                  tabIndex={0}
                  role="region"
                  aria-label="Texte complet du mandat de prélèvement SEPA"
                >
                  <pre className={s.mandateText}>{mandate}</pre>
                </div>
              </div>

              <div className={s.field}>
                <label className={s.checkRow}>
                  <input
                    type="checkbox"
                    checked={mandateAccepted}
                    onChange={(e) => setMandateAccepted(e.target.checked)}
                    aria-invalid={errors["mandateAccepted"] ? true : undefined}
                    aria-describedby={
                      errors["mandateAccepted"] ? "mandate-err" : undefined
                    }
                  />
                  <span>
                    J&apos;accepte le mandat de prélèvement SEPA ci-dessus. La
                    référence unique de mandat (RUM) me sera communiquée par
                    email avec la copie du mandat signé.
                  </span>
                </label>
                {errors["mandateAccepted"] && (
                  <p className={s.fieldError} id="mandate-err">
                    <IconAlert /> {errors["mandateAccepted"]}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ============ Étape — Documents contractuels ============ */}
          {stepKeys[step] === "documents" && (
            <div className={s.sectionGap}>
              <div className={s.alert}>
                <IconAlert />
                <span>
                  Ces documents officiels encadrent votre abonnement MediCare
                  Pro. Ouvrez-les d&apos;un clic — chaque page propose le PDF
                  officiel en téléchargement.
                </span>
              </div>

              <ul className={s.docList}>
                {Object.values(LEGAL_DOCUMENTS).map((doc) => (
                  <li key={doc.key} className={s.docItem}>
                    <div className={s.docMain}>
                      <a
                        href={doc.pageHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={s.docTitle}
                      >
                        {doc.title}
                      </a>
                      <span className={s.docMeta}>Version {doc.version}</span>
                    </div>
                    {/* Ouvre le document SANS quitter le tunnel : on demande
                        au praticien d'accepter ces textes, donc de les lire.
                        L'envoyer dans un autre onglet lui faisait perdre le fil
                        de son inscription. Le téléchargement reste offert dans
                        la visionneuse. */}
                    <button
                      type="button"
                      className={s.docPdf}
                      onClick={() =>
                        setPdf({
                          title: doc.title,
                          version: doc.version,
                          href: doc.pdfHref,
                        })
                      }
                      aria-label={`Lire le PDF officiel : ${doc.title} (version ${doc.version})`}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6zm7 1.5L18.5 9H14a1 1 0 0 1-1-1V3.5z" />
                      </svg>
                      PDF
                    </button>
                  </li>
                ))}
                <li className={s.docItem}>
                  <div className={s.docMain}>
                    <a
                      href="/tarifs"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={s.docTitle}
                    >
                      Grille tarifaire en vigueur
                    </a>
                    <span className={s.docMeta}>
                      Édition {PRICING_VERSION.replace("tarifs-", "")} — vos
                      montants exacts figurent au récapitulatif.
                    </span>
                  </div>
                </li>
              </ul>

              {/* Case contractuelle UNIQUE (art. 5 CGV v2.1) : obligatoire,
                  non pré-cochée, libellé exact du client (cf. TERMS_LABEL
                  archivé en preuve) rendu avec les liens vers chaque document. */}
              <div className={s.field}>
                <label className={s.checkRow}>
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    aria-invalid={errors["termsAccepted"] ? true : undefined}
                    aria-describedby={
                      errors["termsAccepted"] ? "terms-err" : undefined
                    }
                  />
                  <span>
                    J&apos;ai lu et j&apos;accepte les{" "}
                    <a href="/cgv" target="_blank" rel="noopener noreferrer">
                      Conditions Générales de Vente
                    </a>
                    , les{" "}
                    <a href="/cgu" target="_blank" rel="noopener noreferrer">
                      Conditions Générales d&apos;Utilisation
                    </a>
                    , l&apos;
                    <a href="/dpa" target="_blank" rel="noopener noreferrer">
                      Accord de Traitement des Données (DPA)
                    </a>{" "}
                    et la{" "}
                    <a href="/tarifs" target="_blank" rel="noopener noreferrer">
                      grille tarifaire en vigueur
                    </a>
                    , et je reconnais avoir pris connaissance de la{" "}
                    <a
                      href="/confidentialite"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Politique de Confidentialité
                    </a>{" "}
                    et de la{" "}
                    <a href="/cookies" target="_blank" rel="noopener noreferrer">
                      Politique de Cookies
                    </a>
                    .
                  </span>
                </label>
                {errors["termsAccepted"] && (
                  <p className={s.fieldError} id="terms-err">
                    <IconAlert /> {errors["termsAccepted"]}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ================= Étape — Récapitulatif ================= */}
          {stepKeys[step] === "recap" && (
            <div className={s.sectionGap}>
              <div className={s.recap}>
                <div className={s.recapBlock}>
                  <div className={s.recapHeadRow}>
                    <h3>Formule</h3>
                    <button
                      type="button"
                      className={s.editBtn}
                      onClick={() => goTo(0)}
                    >
                      Modifier
                    </button>
                  </div>
                  <div className={s.recapList}>
                    <span>
                      <b>{PLAN_LABEL[plan]}</b>
                      {extra > 0 &&
                        ` + ${extra} collaborateur${extra > 1 ? "s" : ""}`}
                    </span>
                    <span>
                      Mensualité&nbsp;: <b>{row.monthlyLabel} TTC/mois</b>
                    </span>
                    <span className={s.recapTotal}>
                      Débité aujourd&apos;hui par carte&nbsp;:{" "}
                      {versements.length > 0
                        ? `${formatEuros(versements[0])} TTC (1er des ${versements.length} versements)`
                        : `${row.totalLabel} TTC ${plan === "ANNUAL" ? "(12 mois)" : "(1er mois)"}`}
                    </span>
                    {/* Le calendrier RÉPÉTÉ ici, et pas seulement à l'étape 1 :
                        c'est le dernier écran avant le débit, et c'est celui
                        qu'on relit quand on conteste. */}
                    {versements.length > 1 && (
                      <span>
                        Puis {versements.length - 1} versements de{" "}
                        <b>{formatEuros(versements[1])} TTC</b>, prélevés
                        automatiquement à un mois d&apos;intervalle sur la même
                        carte. Total {row.totalLabel} TTC, sans supplément.
                      </span>
                    )}
                    {!sepaEnabled &&
                      (plan === "ANNUAL" && !annualRenews ? (
                        <span>
                          Paiement unique, accès 12 mois — sans reconduction
                          automatique.
                        </span>
                      ) : (
                        <span>
                          Puis {row.totalLabel} TTC chaque{" "}
                          {plan === "ANNUAL" ? "année" : "mois"}, par
                          reconduction automatique sur la même carte.
                        </span>
                      ))}
                  </div>
                </div>

                <div className={s.recapBlock}>
                  <div className={s.recapHeadRow}>
                    <h3>Cabinet</h3>
                    <button
                      type="button"
                      className={s.editBtn}
                      onClick={() => goTo(1)}
                    >
                      Modifier
                    </button>
                  </div>
                  <div className={s.recapList}>
                    <span>
                      <b>{cabinet.name}</b> — {cabinet.email}
                    </span>
                    <span>
                      {cabinet.address}, {cabinet.postalCode} {cabinet.city}
                    </span>
                    <span>
                      SIRET {cabinet.siretNumber}
                      {cabinet.rppsNumber && ` · RPPS ${cabinet.rppsNumber}`}
                    </span>
                  </div>
                </div>

                <div className={s.recapBlock}>
                  <div className={s.recapHeadRow}>
                    <h3>Administrateur</h3>
                    <button
                      type="button"
                      className={s.editBtn}
                      onClick={() => goTo(2)}
                    >
                      Modifier
                    </button>
                  </div>
                  <div className={s.recapList}>
                    <span>
                      <b>
                        {user.firstName} {user.lastName}
                      </b>{" "}
                      — {user.email}
                    </span>
                  </div>
                </div>

                {sepaEnabled && (
                  <div className={s.recapBlock}>
                    <div className={s.recapHeadRow}>
                      <h3>Prélèvement SEPA (renouvellement)</h3>
                      <button
                        type="button"
                        className={s.editBtn}
                        onClick={() => goTo(indexOfStep("sepa"))}
                      >
                        Modifier
                      </button>
                    </div>
                    <div className={s.recapList}>
                      <span>
                        <b>{sepa.accountHolder}</b>
                      </span>
                      <span>
                        {ibanValid ? maskIban(sepa.iban) : "IBAN à valider"}
                      </span>
                    </div>
                  </div>
                )}

                <div className={s.recapBlock}>
                  <div className={s.recapHeadRow}>
                    <h3>Documents contractuels</h3>
                    <button
                      type="button"
                      className={s.editBtn}
                      onClick={() => goTo(indexOfStep("documents"))}
                    >
                      Modifier
                    </button>
                  </div>
                  <div className={s.recapList}>
                    <span>
                      ✓ CGV, CGU, DPA et grille tarifaire acceptées —
                      politiques de confidentialité et de cookies consultées.
                    </span>
                  </div>
                </div>
              </div>

              {/* Anti-bot Cloudflare Turnstile */}
              <div className={s.turnstileWrap}>
                {siteKey ? (
                  <>
                    <div
                      ref={turnstileHost}
                      className="cf-turnstile"
                      data-sitekey={siteKey}
                    />
                    {/* Le script n'est jamais arrivé. On le dit, et on donne
                        une issue : sans ça, le praticien lit « Merci de valider
                        la vérification anti-robot » au-dessus d'un cadre vide,
                        et il n'a RIEN à cliquer. */}
                    {turnstileBloque && (
                      <div className={s.banner} role="alert">
                        <IconAlert />
                        <span>
                          La vérification anti-robot n&apos;a pas pu se charger.
                          Elle est parfois bloquée par un bloqueur de publicité,
                          une extension de confidentialité ou un réseau
                          d&apos;entreprise. Rechargez la page, essayez un autre
                          navigateur, ou écrivez-nous à contact@medicarepro.fr —
                          nous finalisons votre inscription avec vous.
                        </span>
                      </div>
                    )}
                    {errors["turnstileToken"] && !turnstileBloque && (
                      <p className={s.fieldError} id="turnstile-err">
                        <IconAlert /> {errors["turnstileToken"]}
                      </p>
                    )}
                  </>
                ) : (
                  <div className={s.banner} role="alert">
                    <IconAlert />
                    <span>
                      La vérification anti-robot est indisponible pour le
                      moment. Réessayez plus tard ou contactez-nous à
                      contact@medicarepro.fr.
                    </span>
                  </div>
                )}
              </div>

              {/* Honeypot — invisible pour un humain, rempli par les bots. */}
              <div className={s.honeypot} aria-hidden="true">
                <label htmlFor="checkout-website">Site web</label>
                <input
                  id="checkout-website"
                  type="text"
                  name="website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>
            </div>
          )}

          {/* ---- Navigation ---- */}
          <div className={s.nav}>
            {step > 0 ? (
              <button
                type="button"
                className={s.btnGhost}
                onClick={goBack}
                disabled={submitting}
              >
                ← Retour
              </button>
            ) : (
              <span />
            )}

            {step < STEPS.length - 1 ? (
              <button type="button" className={s.btnPrimary} onClick={goNext}>
                Continuer →
              </button>
            ) : (
              <button
                type="button"
                className={s.btnPrimary}
                onClick={submit}
                disabled={submitting || !siteKey}
              >
                {submitting ? (
                  <>
                    <span className={s.spinner} aria-hidden="true" />
                    Envoi en cours…
                  </>
                ) : (
                  `Payer ${row.totalLabel} par carte`
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <p className={s.foot}>
        <a href="/tarifs" className={s.footLink}>
          ← Revoir le détail des tarifs
        </a>
      </p>
    </div>
  );
}
