"use client";

import { useActionState, useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CardContent } from "@/components/ui/card";
import { Notice } from "@/components/admin/shared";
import { Field, FieldGrid, FormActions } from "@/components/admin/kit/Field";
import { cn } from "@/lib/utils";
import {
  addMember,
  type NewMemberState,
} from "@/app/admin/(protected)/utilisateurs/actions";

/* ============================================================
   Ajouter un membre à l'équipe du back office.

   L'invitation par email est le chemin normal : la personne choisit
   elle-même son mot de passe, personne d'autre ne le connaît. La création
   avec mot de passe provisoire reste possible (bouton secondaire) pour
   dépanner quelqu'un qui ne reçoit pas l'email.

   Le lien d'invitation est aussi montré ici, une fois : si l'email tarde
   ou tombe en indésirables, l'administrateur peut le transmettre lui-même.
   ============================================================ */

const ROLES: { value: "editor" | "admin"; title: string; text: string }[] = [
  {
    value: "editor",
    title: "Éditeur",
    text: "Contenu du site : pages, blog, médias, demandes de contact et SEO.",
  },
  {
    value: "admin",
    title: "Administrateur",
    text: "Tout, y compris la facturation, les comptes de l'équipe, les réglages et le journal d'audit.",
  },
];

function CopyButton({ value, label = "Copier" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => {
        void navigator.clipboard.writeText(value);
        setCopied(true);
      }}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? "Copié" : label}
    </Button>
  );
}

export default function NewMemberForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"editor" | "admin">("editor");

  const [state, action, pending] = useActionState<NewMemberState, FormData>(
    async (prev, formData) => {
      const result = await addMember(prev, formData);
      if (result?.ok) {
        setEmail("");
        setName("");
        setRole("editor");
      }
      return result;
    },
    null,
  );

  const fieldError = (field: "email" | "name") =>
    state && !state.ok && state.field === field ? state.error : undefined;

  return (
    <form action={action} className="flex flex-col">
      <CardContent className="flex flex-col gap-4">
        <FieldGrid>
          <Field
            span="@narrow/page:col-span-3 @wide/page:col-span-7"
            label="Email professionnel"
            htmlFor="member-email"
            required
            error={fieldError("email")}
            hint="Devient l'identifiant de connexion."
          >
            <Input
              id="member-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder="prenom.nom@medicarepro.fr"
              required
              maxLength={180}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field
            span="@narrow/page:col-span-3 @wide/page:col-span-5"
            label="Nom affiché"
            htmlFor="member-name"
            optional
            error={fieldError("name")}
            hint="Sinon, le début de l'adresse email."
          >
            <Input
              id="member-name"
              name="name"
              autoComplete="off"
              placeholder="Prénom Nom"
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
        </FieldGrid>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-cell font-medium text-foreground">
            Rôle<span className="text-destructive"> *</span>
          </legend>
          <div className="grid gap-3 @narrow/page:grid-cols-2">
            {ROLES.map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-xl border p-3.5 transition-colors",
                  role === option.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-secondary/50",
                )}
              >
                <input
                  type="radio"
                  name="role"
                  value={option.value}
                  checked={role === option.value}
                  onChange={() => setRole(option.value)}
                  className="mt-1 accent-[color:var(--primary)]"
                />
                <span className="min-w-0">
                  <span className="block text-cell font-medium text-foreground">
                    {option.title}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                    {option.text}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {state && !state.ok && !state.field && (
          <Notice tone="bad" title="Rien n'a été envoyé">
            {state.error}
          </Notice>
        )}

        {state?.ok && state.kind === "invite" && (
          <Notice
            tone={state.emailSent ? "ok" : "warn"}
            title={
              state.emailSent
                ? state.replaced
                  ? `Nouvelle invitation envoyée à ${state.email} (l'ancien lien ne fonctionne plus)`
                  : `Invitation envoyée à ${state.email}`
                : `Compte créé, mais l'email à ${state.email} n'est pas parti`
            }
          >
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-md border border-border bg-card px-2.5 py-2 font-mono text-xs">
                {state.link}
              </code>
              <CopyButton value={state.link} label="Copier le lien" />
            </div>
            <p className="mt-2 text-xs leading-relaxed">
              {state.emailSent
                ? "Vous pouvez aussi transmettre ce lien vous-même, par message."
                : "Transmettez ce lien à la personne, par message."}{" "}
              Il est personnel, valable 24 heures, et ouvre la session du nouveau
              membre : pour le tester vous-même, utilisez une fenêtre de
              navigation privée.
            </p>
          </Notice>
        )}

        {state?.ok && state.kind === "direct" && (
          <Notice tone="ok" title={`Compte créé pour ${state.email}`}>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="select-all rounded-md border border-dashed border-[color:var(--ok)]/40 bg-card px-3 py-1.5 font-mono text-[13px] text-foreground">
                {state.password}
              </code>
              <CopyButton value={state.password} label="Copier le mot de passe" />
            </div>
            <p className="mt-2 text-xs leading-relaxed">
              Mot de passe provisoire, affiché une seule fois. Transmettez-le par un
              canal sûr ; la personne pourra le changer avec « Mot de passe oublié ».
            </p>
          </Notice>
        )}
      </CardContent>

      <FormActions>
        {/* L'invitation est PREMIÈRE dans le DOM : c'est le bouton que la
            touche Entrée déclenche. `order` la replace à droite. */}
        <Button
          type="submit"
          name="intent"
          value="invite"
          size="sm"
          disabled={pending}
          className="order-2"
        >
          {pending ? "Envoi…" : "Envoyer l'invitation"}
        </Button>
        <Button
          type="submit"
          name="intent"
          value="direct"
          variant="ghost"
          size="sm"
          disabled={pending}
          className="order-1 text-muted-foreground"
        >
          Créer avec un mot de passe provisoire
        </Button>
      </FormActions>
    </form>
  );
}
