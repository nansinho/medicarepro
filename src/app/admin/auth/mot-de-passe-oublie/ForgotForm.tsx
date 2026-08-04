"use client";

import { useState, useTransition } from "react";
import { requestPasswordReset } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotForm() {
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await requestPasswordReset(formData);
      setSent(true);
    });
  }

  if (sent) {
    return (
      <p
        role="status"
        className="rounded-md border border-[color:var(--ok)]/30 bg-[color:var(--ok)]/8 px-3 py-2.5 text-[13px] text-muted-foreground"
      >
        C&apos;est envoyé. Si un compte existe pour cette adresse, un email arrive d&apos;ici quelques
        minutes (pensez aux indésirables).
      </p>
    );
  }

  return (
    <form className="flex flex-col gap-4" action={handleSubmit}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="forgot-email">Email</Label>
        <Input
          id="forgot-email"
          type="email"
          name="email"
          autoComplete="username"
          required
          placeholder="vous@medicarepro.fr"
        />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Envoi en cours" : "Recevoir le lien"}
      </Button>
    </form>
  );
}
