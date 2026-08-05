import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { serviceClient } from "@/lib/supabase/service";
import { openSession, PORTAL_COOKIE } from "@/lib/billing/portal";

/* ============================================================
   GET /mon-abonnement/facture/[id] — téléchargement d'une facture.

   Le contrôle d'accès ne se fait PAS sur l'identifiant de facture (qui vient
   du navigateur) mais sur le cabinet de la session : on ne sert le PDF que si
   la facture appartient à un abonnement de CE cabinet. Un identifiant deviné
   ou récupéré ailleurs ne donne donc rien.

   Le PDF n'est jamais servi en direct : le bucket 'billing' est privé, on
   redirige vers une URL signée de 60 secondes, comme le back-office.
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const jar = await cookies();
  const session = openSession(jar.get(PORTAL_COOKIE)?.value);
  if (!session) {
    /* Pas de 403 sec : on renvoie le praticien là où il peut rouvrir sa
       session. Location RELATIF, comme le point d'entrée : `nextUrl.origin`
       vaut « https://0.0.0.0:3000 » derrière le serveur standalone. */
    return new Response(null, {
      status: 303,
      headers: { location: "/mon-abonnement?e=lien" },
    });
  }

  const supabase = serviceClient();
  if (!supabase) {
    return new Response("Service momentanément indisponible.", { status: 503 });
  }

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return new Response("Facture introuvable.", { status: 404 });
  }

  /* Les abonnements du cabinet — y compris les contrats clos : une facture
     reste téléchargeable après la fin de l'abonnement, c'est une pièce
     comptable que le praticien doit conserver. */
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("app_cabinet_id", session.appCabinetId);

  const ids = (subs ?? []).map((row) => (row as { id: string }).id);
  if (ids.length === 0) {
    return new Response("Facture introuvable.", { status: 404 });
  }

  const { data: invoice } = await supabase
    .from("invoices")
    .select("pdf_path, hosted_invoice_url, subscription_id")
    .eq("id", id)
    .in("subscription_id", ids)
    .maybeSingle();

  if (!invoice) {
    return new Response("Facture introuvable.", { status: 404 });
  }

  /* Facture émise par Stripe : le document est chez lui, notre registre n'en
     garde que l'adresse. Le contrôle d'accès a déjà eu lieu ci-dessus — la
     facture appartient bien à un contrat de ce cabinet — et l'adresse hébergée
     de Stripe porte son propre jeton, elle n'est pas devinable. */
  if (!invoice.pdf_path) {
    if (invoice.hosted_invoice_url) {
      return NextResponse.redirect(invoice.hosted_invoice_url as string);
    }
    return new Response(
      "Cette facture n'a pas de document consultable. Écrivez-nous à contact@medicarepro.fr.",
      { status: 404 },
    );
  }

  const { data: signed, error } = await supabase.storage
    .from("billing")
    .createSignedUrl(invoice.pdf_path as string, 60);

  if (error || !signed?.signedUrl) {
    console.error(
      "[portail-facture] échec de signature d'URL :",
      error?.message ?? "réponse vide",
    );
    return new Response("PDF momentanément indisponible.", { status: 502 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
