import { type NextRequest } from "next/server";
import { hasBilling, billingEnv } from "@/lib/env";
import { serviceClient } from "@/lib/supabase/service";
import { timingSafeEqualString } from "@/lib/crypto";
import { clientIpFrom } from "@/lib/http/client-ip";
import { createPortalLink, type PortalCabinet } from "@/lib/billing/portal";

/* ============================================================
   POST /api/portal/session — ouverture d'un accès à l'espace abonnement.

   APPELÉE PAR L'APPLICATION MÉTIER (dev B), serveur à serveur, derrière le
   bouton « Gérer mon abonnement ». L'app nous transmet son `cabinetId` et les
   coordonnées du cabinet ; nous rendons une URL à usage unique, valable
   quelques minutes, vers laquelle elle redirige le praticien.

   POURQUOI CE SENS : la vitrine n'a aucun moyen de retrouver un cabinet dans
   l'app (aucune route de recherche n'existe côté dev B, et son back-office est
   derrière un JWT super-admin). En faisant porter l'identité par l'appelant,
   le problème disparaît — et le praticien n'a ni compte ni mot de passe à
   gérer sur la vitrine.

   AUTHENTIFICATION : la clé de provisioning déjà partagée avec dev B, sous le
   même nom d'en-tête que les deux routes existantes. Aucun secret nouveau à
   distribuer. La clé permet déjà de créer des comptes : elle ne donne donc pas
   ici un pouvoir d'une autre nature.

   ⚠️ Les montants ne viennent JAMAIS de l'appelant : la formule et le prix
   sont calculés par la grille tarifaire de la vitrine au moment de payer.
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AUTH_HEADER = "x-medicarepro-provision-authorization";

type Body = {
  cabinetId?: unknown;
  userId?: unknown;
  cabinet?: Record<string, unknown>;
};

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  if (!hasBilling()) {
    return Response.json(
      { success: false, error: "Facturation non configurée." },
      { status: 503 },
    );
  }

  const expected = billingEnv().provisioningApiKey;
  const provided = request.headers.get(AUTH_HEADER) ?? "";
  if (!provided || !timingSafeEqualString(provided, expected)) {
    return Response.json({ success: false, error: "Clé refusée." }, { status: 401 });
  }

  const supabase = serviceClient();
  if (!supabase) {
    return Response.json(
      { success: false, error: "Base non configurée." },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ success: false, error: "Corps invalide." }, { status: 400 });
  }

  const cabinetId = str(body.cabinetId);
  if (!cabinetId) {
    return Response.json(
      { success: false, error: "cabinetId requis." },
      { status: 400 },
    );
  }

  const raw = body.cabinet ?? {};
  const cabinet: PortalCabinet = {
    name: str(raw.name),
    email: str(raw.email),
    address: str(raw.address),
    postalCode: str(raw.postalCode),
    city: str(raw.city),
    invoicePrefix: str(raw.invoicePrefix),
    siretNumber: str(raw.siretNumber) || undefined,
    adminEmail: str(raw.adminEmail) || str(raw.email),
    adminName: str(raw.adminName),
    plan: str(raw.plan) || null,
    maxAssistants:
      typeof raw.maxAssistants === "number" ? raw.maxAssistants : null,
  };

  /* Le nom et un email sont indispensables : sans eux, impossible d'émettre
     une facture ni d'envoyer un reçu. Le reste peut être complété au moment
     de souscrire. */
  if (!cabinet.name || !cabinet.adminEmail) {
    return Response.json(
      { success: false, error: "cabinet.name et un email sont requis." },
      { status: 400 },
    );
  }

  try {
    const { url, expiresAt } = await createPortalLink(supabase, {
      appCabinetId: cabinetId,
      appUserId: str(body.userId) || null,
      cabinet,
      createdVia: "app",
      clientIp: clientIpFrom(request.headers),
    });
    return Response.json({
      success: true,
      data: { url, expiresAt: expiresAt.toISOString() },
    });
  } catch (err) {
    // Jamais de corps ni de clé dans les logs : message court uniquement.
    console.error(
      "[portal-session] création du lien :",
      err instanceof Error ? err.message : String(err),
    );
    return Response.json(
      { success: false, error: "Lien indisponible." },
      { status: 502 },
    );
  }
}
