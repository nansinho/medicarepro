import type { Metadata } from "next";
import { Suspense } from "react";
import ConfirmForm from "./ConfirmForm";

export const metadata: Metadata = {
  title: "Activation du compte",
  robots: { index: false, follow: false },
};

/* Atterrissage des liens d'invitation (type=invite) et de
   réinitialisation (type=recovery) : vérifie le token GoTrue puis
   fait choisir le mot de passe. Route publique (allowlist proxy). */
export default function AdminAuthConfirmPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmForm />
    </Suspense>
  );
}
