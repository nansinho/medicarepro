import Link from "next/link";
import { Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/* Carte « Accès réservé » des sections admin-only (facturation,
   réglages, utilisateurs…), rendue DANS le shell, à la place du
   contenu de la section. */
export default function AccessDenied({
  email,
  scope,
}: {
  email: string;
  scope: string;
}) {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <Card className="w-full max-w-md p-8 text-center">
        <span className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/20">
          <Lock className="size-6" />
        </span>
        <h1 className="text-lg font-semibold tracking-tight text-foreground">Accès réservé</h1>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
          Cette section ({scope}) est réservée aux administrateurs. Votre compte ({email}) a le rôle
          « éditeur ». Contactez un administrateur si vous pensez qu&apos;il s&apos;agit d&apos;une erreur.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button asChild>
            <Link href="/admin/contenu">Retour au contenu</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/login">Changer de compte</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
