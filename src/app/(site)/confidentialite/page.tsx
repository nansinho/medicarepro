import type { Metadata } from "next";
import LegalPage from "@/components/site/LegalPage";
import { pageMetadata } from "@/lib/cms/seo";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/confidentialite");
}

export default async function ConfidentialitePage() {
  return <LegalPage slug="/confidentialite" label="Politique de confidentialité" />;
}
