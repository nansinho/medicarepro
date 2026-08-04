import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageStack } from "@/components/admin/kit/layout";
import { EmptyState } from "@/components/admin/kit/states";

export default function AdminNotFound() {
  return (
    <PageStack>
      <EmptyState
        variant="page"
        icon={FileQuestion}
        title="Cette fiche n'existe pas"
        description="Elle a peut-être été supprimée, ou le lien qui vous a amené ici est périmé."
        action={
          <Button asChild size="sm">
            <Link href="/admin">Retour au tableau de bord</Link>
          </Button>
        }
      />
    </PageStack>
  );
}
