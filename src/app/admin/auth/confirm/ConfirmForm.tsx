"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, Lock } from "@/components/icons";
import { browserClient } from "@/lib/supabase/browser";
import styles from "../../login/login.module.css";

/* ============================================================
   1. verifyOtp(token_hash) au chargement → session établie.
   2. Formulaire « choisir un mot de passe » → updateUser.
   3. Redirection complète vers /admin (le proxy relit les cookies).
   ============================================================ */

type Step =
  | { kind: "verifying" }
  | { kind: "password" }
  | { kind: "invalid"; message: string };

export default function ConfirmForm() {
  const params = useSearchParams();
  const tokenHash = params.get("token_hash");
  const [step, setStep] = useState<Step>(() =>
    tokenHash
      ? { kind: "verifying" }
      : { kind: "invalid", message: "Lien incomplet ou déjà utilisé." },
  );
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const type = params.get("type") === "recovery" ? "recovery" : "invite";

  useEffect(() => {
    if (!tokenHash) return;
    browserClient()
      .auth.verifyOtp({ type, token_hash: tokenHash })
      .then(({ error: verifyError }) => {
        if (verifyError) {
          setStep({
            kind: "invalid",
            message:
              "Ce lien est expiré ou a déjà été utilisé. Demandez un nouveau lien à un administrateur" +
              (type === "recovery"
                ? " ou refaites une demande depuis « mot de passe oublié »."
                : "."),
          });
        } else {
          setStep({ kind: "password" });
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- vérification unique au montage
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password.length < 10) {
      setError("Le mot de passe doit faire au moins 10 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setPending(true);
    const { error: updateError } = await browserClient().auth.updateUser({
      password,
    });
    if (updateError) {
      setError(`Impossible d'enregistrer : ${updateError.message}`);
      setPending(false);
      return;
    }
    /* Navigation complète : le proxy doit relire la session. */
    window.location.assign("/admin");
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG statique */}
          <img src="/logo.svg?v=6" alt="MediCare Pro" width={184} height={38} />
          <span className={styles.kicker}>
            <Lock width={12} height={12} /> Back office
          </span>
        </div>

        {step.kind === "verifying" && (
          <>
            <h1>Vérification…</h1>
            <p className={styles.lead}>Validation de votre lien en cours.</p>
          </>
        )}

        {step.kind === "invalid" && (
          <>
            <h1>Lien invalide</h1>
            <p className={styles.lead}>{step.message}</p>
            <Link href="/admin/login" className={styles.backLink}>
              Aller à la connexion
            </Link>
          </>
        )}

        {step.kind === "password" && (
          <>
            <h1>
              {type === "invite"
                ? "Bienvenue ! Choisissez votre mot de passe"
                : "Nouveau mot de passe"}
            </h1>
            <p className={styles.lead}>
              10 caractères minimum — utilisez votre gestionnaire de mots de
              passe.
            </p>
            <form className={styles.form} onSubmit={handleSubmit}>
              <label className={styles.field}>
                <span>Mot de passe</span>
                <div className={styles.passwordWrap}>
                  <input
                    type={show ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={10}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className={styles.eye}
                    onClick={() => setShow((v) => !v)}
                    aria-label={show ? "Masquer" : "Afficher"}
                  >
                    {show ? <EyeOff width={18} height={18} /> : <Eye width={18} height={18} />}
                  </button>
                </div>
              </label>
              <label className={styles.field}>
                <span>Confirmez le mot de passe</span>
                <input
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={10}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </label>
              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}
              <button type="submit" className={styles.submit} disabled={pending}>
                {pending ? "Enregistrement…" : "Enregistrer et accéder au back office"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
