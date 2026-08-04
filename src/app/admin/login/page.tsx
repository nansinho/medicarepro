import type { Metadata } from "next";
import Link from "next/link";
import { GeistSans } from "geist/font/sans";
import { ArrowRight, Lock } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { Card } from "@/components/ui/card";
import LoginForm from "./LoginForm";
import "../(protected)/admin-theme.css";

export const metadata: Metadata = {
  title: "Connexion au back office",
  robots: { index: false, follow: false },
};

/* Page de connexion du back office. Un staff déjà connecté est
   redirigé vers /admin par le proxy avant d'arriver ici.
   Enveloppée dans .admin-scope pour hériter des tokens shadcn. */
export default function AdminLoginPage() {
  return (
    <div className={`admin-scope ${GeistSans.variable}`}>
      <main className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm p-6">
          <div className="mb-5 flex items-center justify-between">
            <BrandLogo size={34} />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              <Lock className="size-3" />
              Back office
            </span>
          </div>

          <h1 className="text-xl font-semibold tracking-tight text-foreground">Connexion</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Espace réservé à l&apos;équipe MediCare Pro.
          </p>

          <div className="mt-5">
            <LoginForm />
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-[13px]">
            <Link href="/admin/auth/mot-de-passe-oublie" className="text-primary hover:underline">
              Mot de passe oublié ?
            </Link>
            <Link href="/" className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground">
              Retour au site
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </Card>
      </main>
    </div>
  );
}
