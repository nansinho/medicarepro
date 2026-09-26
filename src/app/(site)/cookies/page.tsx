import type { Metadata } from "next";
import LegalPage from "@/components/site/LegalPage";
import { pageMetadata } from "@/lib/cms/seo";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/cookies");
}

export default async function CookiesPage() {
  return <LegalPage slug="/cookies" label="Politique de cookies" />;
}
