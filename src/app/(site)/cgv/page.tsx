import type { Metadata } from "next";
import LegalPage from "@/components/site/LegalPage";
import { pageMetadata } from "@/lib/cms/seo";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/cgv");
}

export default async function CgvPage() {
  return <LegalPage slug="/cgv" label="Conditions générales de vente" />;
}
