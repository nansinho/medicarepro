"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import { friendlyFormatIBAN, isValidIBAN } from "ibantools";
import {
  CabinetSchema,
  UserSchema,
  SepaSchema,
  CheckoutSchema,
} from "@/lib/checkout/schema";
import type { BillingPlan } from "@/lib/checkout/pricing";
import { PRICING_VERSION } from "@/lib/checkout/pricing";
import { LEGAL_DOCUMENTS } from "@/lib/legal/registry";
import { mandateText } from "@/lib/sepa/mandate-text";
import { maskIban } from "@/lib/sepa/iban";
import PasswordStrength from "@/components/auth/PasswordStrength";
import MoneticoRedirectForm from "./MoneticoRedirectForm";
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
  siteKey?: string;
  /** Identifiant Créancier SEPA — figure sur tous les mandats (donnée publique du créancier). */
  sepaIcs: string;
  prices: PriceTable;
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

const STEPS = [
  "Formule",
  "Cabinet",
  "Administrateur",
  "Mandat SEPA",
  "Documents",
  "Récapitulatif",
] as const;

const MAX_COLLABS = 20;

const PLAN_LABEL: Record<BillingPlan, string> = {
  MONTHLY: "Mensuel sans engagement",
  ANNUAL: "Offre 12 mois",
};

/** Détermine l'étape (index) qui porte une erreur donnée, pour y renvoyer l'utilisateur. */
function stepForErrorKey(key: string): number {
  if (key.startsWith("cabinet.")) return 1;
  if (key.startsWith("user.")) return 2;
  if (key.startsWith("sepa.") || key === "mandateAccepted") return 3;
  if (key === "termsAccepted") return 4;
  if (key === "plan" || key === "extraCollaborators") return 0;
  return 5; // turnstileToken, website…
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
      {hint && !error && (
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
  siteKey,
  sepaIcs,
  prices,
}: Props) {
  /* ---- État du dossier ---- */
  const [step, setStep] = useState(0);
  const [plan, setPlan] = useState<BillingPlan>(initialPlan);
  const [extra, setExtra] = useState(0);
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
  const [showPassword, setShowPassword] = useState(false);
  const [sepa, setSepa] = useState({ iban: "", bic: "", accountHolder: "" });
  const [ibanTouched, setIbanTouched] = useState(false);
  const [mandateAccepted, setMandateAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot — reste vide chez un humain

  /* ---- Auto-remplissage SIRET (annuaire des entreprises) ---- */
  const [siretLookup, setSiretLookup] = useState<{
    status: "idle" | "loading" | "found" | "not_found" | "error";
    name?: string;
  }>({ status: "idle" });

  /* ---- État technique ---- */
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [redirect, setRedirect] = useState<{
    action: string;
    fields: Record<string, string>;
  } | null>(null);

  /* ---- Turnstile ---- */
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReady, setTurnstileReady] = useState(false);
  const turnstileHost = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetId = useRef<string | null>(null);

  const cardTitleRef = useRef<HTMLHeadingElement | null>(null);
  const firstRender = useRef(true);

  const row = prices[plan][extra];
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

  /* SIRET complet (14 chiffres) → interrogation de l'annuaire des
     entreprises et pré-remplissage des champs ENCORE VIDES uniquement
     (on n'écrase jamais une saisie). Service de confort : toute erreur
     est silencieuse et n'empêche pas de continuer. */
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
          found: boolean;
          name?: string;
          address?: string;
          postalCode?: string;
          city?: string;
        };
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
        setSiretLookup({ status: "found", name: data.name });
      } catch {
        if (!controller.signal.aborted) setSiretLookup({ status: "error" });
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [cabinet.siretNumber]);

  /* Pré-remplit le titulaire du compte avec le nom du cabinet à l'arrivée sur l'étape SEPA. */
  useEffect(() => {
    if (step === 3) {
      setSepa((p) =>
        p.accountHolder.trim() === "" ? { ...p, accountHolder: cabinet.name } : p,
      );
    }
  }, [step, cabinet.name]);

  /* Rend le widget Turnstile à l'arrivée sur le récapitulatif (rendu explicite). */
  useEffect(() => {
    if (step !== 5 || !siteKey || !turnstileReady) return;
    const api = window.turnstile;
    const host = turnstileHost.current;
    if (!api || !host || turnstileWidgetId.current !== null) return;

    turnstileWidgetId.current = api.render(host, {
      sitekey: siteKey,
      callback: (token: string) => setTurnstileToken(token),
      "expired-callback": () => setTurnstileToken(""),
      "error-callback": () => setTurnstileToken(""),
    });

    return () => {
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
  }, [step, siteKey, turnstileReady]);

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

  /* ---- Validation par étape ---- */
  function validateStep(index: number): Record<string, string> {
    const errs: Record<string, string> = {};
    if (index === 1) {
      const parsed = CabinetSchema.safeParse(cabinet);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const key = `cabinet.${issue.path.join(".")}`;
          if (!errs[key]) errs[key] = issue.message;
        }
      }
    } else if (index === 2) {
      const parsed = UserSchema.safeParse(user);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const key = `user.${issue.path.join(".")}`;
          if (!errs[key]) errs[key] = issue.message;
        }
      }
      if (user.password !== passwordConfirm) {
        errs["user.passwordConfirm"] = "Les deux mots de passe ne correspondent pas";
      }
    } else if (index === 3) {
      const parsed = SepaSchema.safeParse(sepa);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const key = `sepa.${issue.path.join(".")}`;
          if (!errs[key]) errs[key] = issue.message;
        }
      }
      if (!mandateAccepted) {
        errs["mandateAccepted"] = "Vous devez accepter le mandat de prélèvement";
      }
    } else if (index === 4) {
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
    setStep(Math.min(...Object.keys(errs).map(stepForErrorKey)));
    return true;
  }

  /* ---- Soumission finale → POST /api/checkout ---- */
  async function submit() {
    // Filet de sécurité : la case contractuelle se coche à l'étape 5.
    if (!termsAccepted) {
      setErrors({
        termsAccepted: "Vous devez accepter les conditions contractuelles",
      });
      setStep(4);
      return;
    }
    if (!turnstileToken) {
      setErrors({
        turnstileToken: "Merci de valider la vérification anti-robot",
      });
      return;
    }

    const parsed = CheckoutSchema.safeParse({
      plan,
      extraCollaborators: extra,
      cabinet,
      user,
      sepa,
      termsAccepted,
      mandateAccepted,
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
      setStep(Math.min(...Object.keys(localErrs).map(stepForErrorKey)));
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
          action: string;
          fields: Record<string, string>;
        };
        setRedirect({ action: data.action, fields: data.fields });
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
          "Trop de tentatives. Patientez quelques minutes avant de réessayer.",
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

  /* ---- Redirection Monetico : on remplace tout le tunnel ---- */
  if (redirect) {
    return (
      <div className={s.shell}>
        <MoneticoRedirectForm action={redirect.action} fields={redirect.fields} />
      </div>
    );
  }

  const cardTitles: Record<number, { title: string; desc: string }> = {
    0: {
      title: "Choisissez votre formule",
      desc: "Sans frais d'installation. Résiliable selon les CGV.",
    },
    1: {
      title: "Votre cabinet",
      desc: "Ces informations figureront sur vos factures.",
    },
    2: {
      title: "Compte administrateur",
      desc: "Le praticien titulaire — il gérera le cabinet dans MediCare Pro.",
    },
    3: {
      title: "Mandat de prélèvement SEPA",
      desc: "Pour le renouvellement automatique de votre abonnement. Aucun prélèvement sans prénotification par email.",
    },
    4: {
      title: "Documents contractuels",
      desc: "Les documents qui encadrent votre abonnement — consultables et téléchargeables à tout moment.",
    },
    5: {
      title: "Récapitulatif",
      desc: "Vérifiez votre dossier avant de procéder au paiement.",
    },
  };

  return (
    <div className={s.shell}>
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
            {cardTitles[step].title}
          </h2>
          <p className={s.cardDesc}>{cardTitles[step].desc}</p>
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
                  }`}
                  onClick={() => setPlan("ANNUAL")}
                  aria-pressed={plan === "ANNUAL"}
                >
                  <span className={s.planBadge}>2 mois offerts</span>
                  <div className={s.planName}>Offre 12 mois</div>
                  <div className={s.planPrice}>
                    {prices.ANNUAL[0].monthlyLabel}
                    <span className={s.planPriceUnit}> TTC/mois</span>
                  </div>
                  <div className={s.planDesc}>
                    Facturé {prices.ANNUAL[0].totalLabel} par an, en une fois.
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
                  <span className={s.counterVal} aria-live="polite">
                    {extra}
                  </span>
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
                    Facturé aujourd&apos;hui&nbsp;: {row.totalLabel} TTC{" "}
                    {plan === "ANNUAL" ? "(12 mois)" : "(1er mois)"}
                  </span>
                </div>
              </div>

              <div className={s.alert}>
                <IconAlert />
                <span>
                  Le premier règlement s&apos;effectue par carte bancaire
                  (Monetico&nbsp;— CIC). Les renouvellements seront prélevés par
                  mandat SEPA, mis en place à l&apos;étape&nbsp;4.
                </span>
              </div>
            </div>
          )}

          {/* ================= Étape 2 — Cabinet ================= */}
          {step === 1 && (
            <div className={s.grid2}>
              {/* SIRET en premier (exigence client) : il pré-remplit le
                  reste du formulaire depuis l'annuaire des entreprises. */}
              <div className={`${s.field} ${s.col2}`}>
                <label className={s.label} htmlFor="cab-siret">
                  SIRET
                </label>
                <input
                  id="cab-siret"
                  className={`${s.input} ${
                    errors["cabinet.siretNumber"] ? s.inputInvalid : ""
                  }`}
                  type="text"
                  value={cabinet.siretNumber}
                  onChange={(e) =>
                    setCabinet((p) => ({
                      ...p,
                      siretNumber: e.target.value.replace(/\D/g, "").slice(0, 14),
                    }))
                  }
                  inputMode="numeric"
                  placeholder="14 chiffres"
                  maxLength={14}
                  autoComplete="off"
                  aria-invalid={errors["cabinet.siretNumber"] ? true : undefined}
                  aria-describedby={
                    errors["cabinet.siretNumber"] ? "cab-siret-err" : "cab-siret-live"
                  }
                />
                {errors["cabinet.siretNumber"] ? (
                  <p className={s.fieldError} id="cab-siret-err">
                    <IconAlert /> {errors["cabinet.siretNumber"]}
                  </p>
                ) : siretLookup.status === "loading" ? (
                  <p className={s.hint} id="cab-siret-live">
                    Recherche dans l&apos;annuaire des entreprises…
                  </p>
                ) : siretLookup.status === "found" ? (
                  <p className={s.ibanOk} id="cab-siret-live">
                    ✓ {siretLookup.name ?? "Établissement trouvé"} — coordonnées
                    pré-remplies ci-dessous, vérifiez-les.
                  </p>
                ) : siretLookup.status === "not_found" ? (
                  <p className={s.fieldError} id="cab-siret-live">
                    <IconAlert /> SIRET introuvable dans l&apos;annuaire des
                    entreprises — vérifiez votre saisie.
                  </p>
                ) : siretLookup.status === "error" ? (
                  <p className={s.hint} id="cab-siret-live">
                    Annuaire momentanément indisponible — remplissez les champs
                    manuellement.
                  </p>
                ) : (
                  <p className={s.hint} id="cab-siret-live">
                    Vos coordonnées se pré-rempliront automatiquement depuis
                    l&apos;annuaire officiel des entreprises.
                  </p>
                )}
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
              <Field
                id="cab-phone"
                label="Téléphone fixe"
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
                hint="11 chiffres — identifiant du titulaire au répertoire national des professionnels de santé."
                inputMode="numeric"
                placeholder="11 chiffres"
                maxLength={11}
              />
            </div>
          )}

          {/* ================= Étape 3 — Administrateur ================= */}
          {step === 2 && (
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

              <Field
                id="usr-password2"
                label="Confirmez le mot de passe"
                type={showPassword ? "text" : "password"}
                value={passwordConfirm}
                onChange={setPasswordConfirm}
                error={errors["user.passwordConfirm"]}
                autoComplete="new-password"
                maxLength={200}
                className={s.col2}
              />
            </div>
          )}

          {/* ================= Étape 4 — Mandat SEPA ================= */}
          {step === 3 && (
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

          {/* ============ Étape 5 — Documents contractuels ============ */}
          {step === 4 && (
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
                    <a
                      href={doc.pdfHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={s.docPdf}
                      aria-label={`Télécharger le PDF officiel : ${doc.title} (version ${doc.version})`}
                    >
                      PDF
                    </a>
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

          {/* ================= Étape 6 — Récapitulatif ================= */}
          {step === 5 && (
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
                      Débité aujourd&apos;hui par carte&nbsp;: {row.totalLabel}{" "}
                      TTC {plan === "ANNUAL" ? "(12 mois)" : "(1er mois)"}
                    </span>
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
                      SIRET {cabinet.siretNumber} · RPPS {cabinet.rppsNumber}
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

                <div className={s.recapBlock}>
                  <div className={s.recapHeadRow}>
                    <h3>Prélèvement SEPA (renouvellement)</h3>
                    <button
                      type="button"
                      className={s.editBtn}
                      onClick={() => goTo(3)}
                    >
                      Modifier
                    </button>
                  </div>
                  <div className={s.recapList}>
                    <span>
                      <b>{sepa.accountHolder}</b>
                    </span>
                    <span>{ibanValid ? maskIban(sepa.iban) : "IBAN à valider"}</span>
                  </div>
                </div>

                <div className={s.recapBlock}>
                  <div className={s.recapHeadRow}>
                    <h3>Documents contractuels</h3>
                    <button
                      type="button"
                      className={s.editBtn}
                      onClick={() => goTo(4)}
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
                    {errors["turnstileToken"] && (
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
