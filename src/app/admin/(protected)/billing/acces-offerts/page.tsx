import type { Metadata } from "next";
import { serviceClient } from "@/lib/supabase/service";
import {
  GIFT_INVITATION_COLUMNS,
  giftDisplayState,
  type GiftContractFacts,
  type GiftInvitation,
} from "@/lib/billing/gift";
import { PageHeader, PageStack } from "@/components/admin/kit/layout";
import { NotConfigured } from "@/components/admin/kit/states";
import GiftAccessView from "@/components/admin/billing/GiftAccessView";

/* ============================================================
   Accès offerts.

   Offrir quelques mois de logiciel (concours, partenariat, geste
   commercial) sans rien manipuler à la main dans l'application : le
   bénéficiaire reçoit un lien personnel, s'inscrit comme un client, et Stripe
   tient l'horloge de la période offerte. Cet écran émet les invitations et
   suit ce qu'elles sont devenues, jusqu'à l'abonnement ou la fin sans suite.

   MISE EN PAGE : même grammaire que « Souscriptions ». L'action et la liste à
   gauche, les règles du jeu dans le rail : elles se lisent AVANT d'envoyer.
   ============================================================ */

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Accès offerts" };

type ContractRow = {
  id: string;
  cabinet_name: string;
  status: string;
  gift_ends_at: string | null;
  renewal_count: number;
};

export default async function AccesOffertsPage() {
  const service = serviceClient();

  if (!service) {
    return (
      <PageStack>
        <PageHeader title="Accès offerts" />
        <NotConfigured scope="L'émission d'accès offerts" />
      </PageStack>
    );
  }

  const { data } = await service
    .from("gift_invitations")
    .select(GIFT_INVITATION_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(100);
  const invitations = (data ?? []) as GiftInvitation[];

  /* Le contrat de chaque invitation utilisée, en une requête : c'est lui qui
     dit si la période est en cours, convertie ou terminée. */
  const idsContrats = invitations
    .map((i) => i.subscription_id)
    .filter((id): id is string => Boolean(id));
  const contrats = new Map<string, ContractRow>();
  if (idsContrats.length > 0) {
    const { data: rows } = await service
      .from("subscriptions")
      .select("id, cabinet_name, status, gift_ends_at, renewal_count")
      .in("id", idsContrats);
    for (const row of (rows ?? []) as ContractRow[]) contrats.set(row.id, row);
  }

  /* Page dynamique : l'heure de la requête est exactement ce qu'on veut ici. */
  const now = new Date();

  const lignes = invitations.map((invitation) => {
    const contrat = invitation.subscription_id
      ? (contrats.get(invitation.subscription_id) ?? null)
      : null;
    const faits: GiftContractFacts = contrat
      ? {
          status: contrat.status,
          gift_ends_at: contrat.gift_ends_at,
          renewal_count: contrat.renewal_count,
        }
      : null;
    return { invitation, contrat, etat: giftDisplayState(invitation, faits, now) };
  });

  return <GiftAccessView lignes={lignes} />;
}
