import type { Metadata } from "next";
import LegalPage from "@/components/site/LegalPage";
import { pageMetadata } from "@/lib/cms/seo";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/cgu");
}

export default async function CguPage() {
  return <LegalPage slug="/cgu" label="Conditions générales d'utilisation" />;
}
