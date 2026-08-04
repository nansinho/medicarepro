import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import AuthCard from "@/components/admin/kit/AuthCard";
import LoginForm from "./LoginForm";
import "../(protected)/admin-theme.css";

export const metadata: Metadata = {
  title: "Connexion au back office",
  robots: { index: false, follow: false },
};

/* Page de connexion du back office. Un staff déjà connecté est
   redirigé vers /admin par le proxy avant d'arriver ici. */
export default function AdminLoginPage() {
  return (
    <AuthCard
      title="Connexion"
      description="Espace réservé à l'équipe MediCare Pro."
      footer={
        <>
          <Link
            href="/admin/auth/mot-de-passe-oublie"
            className="text-primary hover:underline"
          >
            Mot de passe oublié ?
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            Retour au site
            <ArrowRight className="size-3.5" />
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthCard>
  );
}
