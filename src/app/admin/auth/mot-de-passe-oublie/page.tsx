import type { Metadata } from "next";
import Link from "next/link";
import AuthCard from "@/components/admin/kit/AuthCard";
import ForgotForm from "./ForgotForm";
import "../../(protected)/admin-theme.css";

export const metadata: Metadata = {
  title: "Mot de passe oublié",
  robots: { index: false, follow: false },
};

export default function MotDePasseOubliePage() {
  return (
    <AuthCard
      title="Mot de passe oublié"
      description="Indiquez votre email : si un compte existe, vous recevrez un lien pour définir un nouveau mot de passe."
      footer={
        <Link href="/admin/login" className="text-primary hover:underline">
          Retour à la connexion
        </Link>
      }
    >
      <ForgotForm />
    </AuthCard>
  );
}
