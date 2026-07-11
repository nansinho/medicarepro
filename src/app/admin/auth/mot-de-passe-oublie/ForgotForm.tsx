"use client";

import { useState, useTransition } from "react";
import { requestPasswordReset } from "./actions";
import styles from "../../login/login.module.css";

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
      <p className={styles.lead} role="status">
        C&apos;est envoyé — si un compte existe pour cette adresse, un email
        arrive d&apos;ici quelques minutes (pensez aux indésirables).
      </p>
    );
  }

  return (
    <form className={styles.form} action={handleSubmit}>
      <label className={styles.field}>
        <span>Email</span>
        <input
          type="email"
          name="email"
          autoComplete="username"
          required
          placeholder="vous@medicarepro.fr"
        />
      </label>
      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? "Envoi…" : "Recevoir le lien"}
      </button>
    </form>
  );
}
