import { buildSearchIndex } from "@/lib/search/buildIndex";

/* ============================================================
   GET /api/search-index — index de recherche du site.
   Dynamique pour refléter les publications CMS sans délai (les
   données sous-jacentes sont déjà cachées par tag) ; le client
   ne le télécharge qu'à la première ouverture de la recherche.
   ============================================================ */
export const dynamic = "force-dynamic";

export async function GET() {
  const entries = await buildSearchIndex();
  return Response.json(
    { entries },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
