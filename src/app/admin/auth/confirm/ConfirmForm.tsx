"use client";

import { useState } from "react";
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
   Atterrissage des liens d'invitation et de réinitialisation.

   LE JETON N'EST CONSOMMÉ QU'À LA VALIDATION DU FORMULAIRE. Il était
   échangé dès l'affichage de la page (useEffect), ce qui le brûlait :
   - en développement, React exécute l'effet deux fois : le second appel
     échouait et la page affichait « Lien invalide » ;
   - en production, les antivirus de messagerie (Outlook, Gmail…) ouvrent
     les liens pour les analyser et peuvent exécuter la page : la personne
     invitée arrivait ensuite sur un lien « déjà utilisé ».
   Un robot ne remplit pas de formulaire : le jeton reste intact jusqu'au
   clic de la personne.

   1. Validation : verifyOtp(token_hash) ouvre la session (une seule fois,
      même si l'enregistrement du mot de passe doit être retenté).
   2. updateUser({ password }).
   3. Navigation complète vers /admin (le proxy relit les cookies).
   ============================================================ */

type LinkType = "invite" | "recovery";

/** Messages GoTrue les plus courants à l'enregistrement du mot de passe. */
const UPDATE_ERRORS: Record<string, string> = {
  same_password: "Ce mot de passe est déjà le vôtre : choisissez-en un autre.",
  weak_password: "Mot de passe trop faible : allongez-le ou variez les caractères.",
};

export default function ConfirmForm() {
  const params = useSearchParams();
  const tokenHash = params.get("token_hash");
  const type: LinkType = params.get("type") === "recovery" ? "recovery" : "invite";
  const email = params.get("email") ?? "";

  const [invalid, setInvalid] = useState<string | null>(
    tokenHash ? null : "Ce lien est incomplet. Ouvrez-le en entier depuis l'email reçu.",
  );
  const [verified, setVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !tokenHash) return;
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
    const supabase = browserClient();

    if (!verified) {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        type,
        token_hash: tokenHash,
      });
      if (verifyError) {
        setInvalid(
          type === "invite"
            ? "Ce lien d'invitation a expiré (il est valable 24 heures) ou a déjà servi. Demandez à la personne qui vous a invité(e) de vous le renvoyer : le nouveau lien remplace l'ancien. Si vous avez déjà choisi votre mot de passe, connectez-vous."
            : "Ce lien a expiré (il est valable 24 heures) ou a déjà servi. Demandez-en un nouveau.",
        );
        setPending(false);
        return;
      }
      setVerified(true);
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(
        UPDATE_ERRORS[updateError.code ?? ""] ??
          `Le mot de passe n'a pas pu être enregistré : ${updateError.message}`,
      );
      setPending(false);
      return;
    }
    window.location.assign("/admin");
  }

  if (invalid) {
    return (
      <AuthCard
        title="Lien expiré ou déjà utilisé"
        description={invalid}
        footer={
          <>
            <Link href="/admin/login" className="text-primary hover:underline">
              Aller à la connexion
            </Link>
            {type === "recovery" && (
              <Link
                href="/admin/auth/mot-de-passe-oublie"
                className="text-primary hover:underline"
              >
                Recevoir un nouveau lien
              </Link>
            )}
          </>
        }
      />
    );
  }

  return (
    <AuthCard
      title={
        type === "invite"
          ? "Bienvenue, choisissez votre mot de passe"
          : "Nouveau mot de passe"
      }
      description={
        type === "invite"
          ? "Dernière étape pour activer votre accès au back office."
          : "Choisissez le mot de passe qui remplacera l'actuel."
      }
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        {email && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cf-email">Identifiant</Label>
            {/* Lecture seule mais présent : les gestionnaires de mots de
                passe l'associent au nouveau mot de passe. */}
            <Input
              id="cf-email"
              type="email"
              autoComplete="username"
              value={email}
              readOnly
              className="bg-secondary/60 text-muted-foreground"
            />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cf-pass">Mot de passe</Label>
          <div className="relative">
            <Input
              id="cf-pass"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={10}
              autoFocus
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
          <p className="text-xs text-muted-foreground">
            10 caractères minimum. Utilisez votre gestionnaire de mots de passe.
          </p>
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
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="w-full">
          {pending
            ? "Activation en cours…"
            : type === "invite"
              ? "Activer mon compte"
              : "Enregistrer le mot de passe"}
        </Button>
      </form>
    </AuthCard>
  );
}
