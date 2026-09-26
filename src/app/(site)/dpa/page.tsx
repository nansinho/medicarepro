import type { Metadata } from "next";
import LegalPage from "@/components/site/LegalPage";
import { pageMetadata } from "@/lib/cms/seo";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/dpa");
}

export default async function DpaPage() {
  return <LegalPage slug="/dpa" label="Accord de traitement des données" />;
}
