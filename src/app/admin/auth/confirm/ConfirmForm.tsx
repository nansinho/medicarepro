"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import AuthCard from "@/components/admin/kit/AuthCard";
import { browserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import "../../(protected)/admin-theme.css";

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
    const { error: updateError } = await browserClient().auth.updateUser({ password });
    if (updateError) {
      setError(`Impossible d'enregistrer : ${updateError.message}`);
      setPending(false);
      return;
    }
    window.location.assign("/admin");
  }

  /* Un seul écran, trois en-têtes : la coque est portée par AuthCard. */
  const heading =
    step.kind === "verifying"
      ? { title: "Vérification en cours", description: "Validation de votre lien." }
      : step.kind === "invalid"
        ? { title: "Lien invalide", description: step.message }
        : {
            title:
              type === "invite"
                ? "Bienvenue, choisissez votre mot de passe"
                : "Nouveau mot de passe",
            description:
              "10 caractères minimum, utilisez votre gestionnaire de mots de passe.",
          };

  return (
    <AuthCard
      title={heading.title}
      description={heading.description}
      footer={
        step.kind === "invalid" ? (
          <Link href="/admin/login" className="text-primary hover:underline">
            Aller à la connexion
          </Link>
        ) : undefined
      }
    >
      {step.kind === "password" && (
              <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cf-pass">Mot de passe</Label>
                  <div className="relative">
                    <Input
                      id="cf-pass"
                      type={show ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={10}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShow((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    >
                      {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cf-confirm">Confirmez le mot de passe</Label>
                  <Input
                    id="cf-confirm"
                    type={show ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={10}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </div>
                {error && (
                  <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                )}
                <Button type="submit" disabled={pending} className="w-full">
                  {pending ? "Enregistrement en cours" : "Enregistrer et accéder au back office"}
                </Button>
              </form>
      )}
    </AuthCard>
  );
}
