import type { Metadata } from "next";
import LegalPage from "@/components/site/LegalPage";
import { pageMetadata } from "@/lib/cms/seo";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/mentions-legales");
}

export default async function MentionsLegalesPage() {
  return <LegalPage slug="/mentions-legales" label="Mentions légales" />;
}
