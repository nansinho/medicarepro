"use client";

import { useState } from "react";
import { Eye, EyeOff } from "@/components/icons";
import { browserClient } from "@/lib/supabase/browser";
import styles from "./login.module.css";

/* Messages GoTrue → français (codes les plus courants du password grant). */
const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "Email ou mot de passe incorrect.",
  over_request_rate_limit:
    "Trop de tentatives. Patientez quelques minutes avant de réessayer.",
  email_not_confirmed: "Cet email n'a pas encore été confirmé.",
  user_banned: "Ce compte est désactivé.",
};

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    let supabase: ReturnType<typeof browserClient>;
    try {
      supabase = browserClient();
    } catch {
      setError("Le back office n'est pas configuré sur cet environnement.");
      setPending(false);
      return;
    }

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError(
        ERROR_MESSAGES[authError.code ?? ""] ??
          "Connexion impossible. Réessayez dans un instant.",
      );
      setPending(false);
      return;
    }

    /* Le rôle autoritaire est dans app_metadata (vérifié aussi côté
       serveur par le proxy et requireStaff — ici, juste pour l'UX). */
    const role = data.user?.app_metadata?.role;
    if (role !== "admin" && role !== "editor") {
      await supabase.auth.signOut();
      setError("Ce compte n'a pas accès au back office.");
      setPending(false);
      return;
    }

    /* Navigation complète (pas de router.push) : le proxy et les Server
       Components doivent relire les cookies de session fraîchement posés. */
    window.location.assign("/admin");
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label className={styles.field}>
        <span>Email</span>
        <input
          type="email"
          name="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vous@medicarepro.fr"
        />
      </label>

      <label className={styles.field}>
        <span>Mot de passe</span>
        <div className={styles.passwordWrap}>
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
          />
          <button
            type="button"
            className={styles.eye}
            onClick={() => setShowPassword((v) => !v)}
            aria-label={
              showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"
            }
          >
            {showPassword ? (
              <EyeOff width={18} height={18} />
            ) : (
              <Eye width={18} height={18} />
            )}
          </button>
        </div>
      </label>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
