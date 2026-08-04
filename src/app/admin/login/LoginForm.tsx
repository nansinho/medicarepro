"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { browserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          type="email"
          name="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vous@medicarepro.fr"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="login-password">Mot de passe</Label>
        <div className="relative">
          <Input
            id="login-password"
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          >
            {showPassword ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
          </button>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2 text-[13px] text-destructive"
        >
          {error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Connexion en cours" : "Se connecter"}
      </Button>
    </form>
  );
}
