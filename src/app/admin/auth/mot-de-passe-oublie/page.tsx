import type { Metadata } from "next";
import Link from "next/link";
import { GeistSans } from "geist/font/sans";
import { Lock } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { Card } from "@/components/ui/card";
import ForgotForm from "./ForgotForm";
import "../../(protected)/admin-theme.css";

export const metadata: Metadata = {
  title: "Mot de passe oublié",
  robots: { index: false, follow: false },
};

export default function MotDePasseOubliePage() {
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

          <h1 className="text-xl font-semibold tracking-tight text-foreground">Mot de passe oublié</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Indiquez votre email : si un compte existe, vous recevrez un lien pour définir un nouveau
            mot de passe.
          </p>

          <div className="mt-5">
            <ForgotForm />
          </div>

          <div className="mt-5 border-t border-border pt-4 text-[13px]">
            <Link href="/admin/login" className="text-primary hover:underline">
              Retour à la connexion
            </Link>
          </div>
        </Card>
      </main>
    </div>
  );
}
