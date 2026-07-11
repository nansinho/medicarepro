import { notFound, permanentRedirect, redirect } from "next/navigation";
import { after } from "next/server";
import { headers } from "next/headers";
import { resolveRedirect, isPermanent } from "@/lib/cms/redirects";
import { recordNotFound, recordRedirectHit } from "@/lib/cms/seo-log";

export const dynamic = "force-dynamic";

/* ============================================================
   Route de dernier recours du site : aucun fichier ne matche.
   1. Redirection gérée (back office SEO) → 308/307.
   2. Sinon : log du 404 (écran « redirections à créer ») puis 404.
   Limite assumée : ne s'exécute pas quand une route réelle matche
   — les routes dynamiques (/blog/[slug], villes) font leur propre
   interception avant leur notFound().
   ============================================================ */

export default async function CatchAllPage({
  params,
}: {
  params: Promise<{ chemin: string[] }>;
}) {
  const { chemin } = await params;
  const path = `/${chemin.map(decodeURIComponent).join("/")}`;

  const managed = await resolveRedirect(path);
  if (managed) {
    after(() => recordRedirectHit(managed.id));
    if (isPermanent(managed)) permanentRedirect(managed.to_path);
    redirect(managed.to_path);
  }

  const headerList = await headers();
  const referer = headerList.get("referer");
  after(() => recordNotFound(path, referer));
  notFound();
}
