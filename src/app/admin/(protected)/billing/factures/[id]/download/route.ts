import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/admin/auth";
import { serviceClient } from "@/lib/supabase/service";

/* ============================================================
   GET /admin/billing/factures/[id]/download
   Téléchargement d'une facture : re-vérifie l'utilisateur ET le
   rôle admin (le proxy et le layout ne protègent pas les route
   handlers de la même manière — défense en profondeur), puis
   redirige vers une URL signée courte (60 s) du bucket privé
   'billing'. Le PDF n'est jamais servi en direct ni public.
   ============================================================ */

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  /* 1. Utilisateur connecté + rôle admin (JWT, autoritaire). */
  const staff = await getStaffUser();
  if (!staff || staff.role !== "admin") {
    return new Response("Accès réservé aux administrateurs.", { status: 403 });
  }

  const service = serviceClient();
  if (!service) {
    return new Response("Supabase non configuré.", { status: 503 });
  }

  /* 2. Miroir profiles.role (défense en profondeur). */
  const { data: profile } = await service
    .from("profiles")
    .select("role")
    .eq("id", staff.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return new Response("Accès réservé aux administrateurs.", { status: 403 });
  }

  /* 3. Facture → URL signée courte sur le bucket privé. */
  const { id } = await params;
  const { data: invoice } = await service
    .from("invoices")
    .select("pdf_path")
    .eq("id", id)
    .maybeSingle();

  if (!invoice?.pdf_path) {
    return new Response("Facture introuvable.", { status: 404 });
  }

  const { data: signed, error } = await service.storage
    .from("billing")
    .createSignedUrl(invoice.pdf_path, 60);

  if (error || !signed?.signedUrl) {
    console.error(
      "[factures] échec de signature d'URL :",
      error?.message ?? "réponse vide",
    );
    return new Response("PDF momentanément indisponible.", { status: 502 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
