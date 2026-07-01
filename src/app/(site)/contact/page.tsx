import type { Metadata } from "next";
import { PageHero } from "@/components/Sections";
import DemoForm from "@/components/DemoForm";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contactez MediCare Pro pour vous abonner ou demander une démonstration. Hébergement HDS en France, données chiffrées et conformes RGPD.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <>
      <PageHero
        kicker="Contact"
        title="Parlons de votre cabinet"
        lead="Une question, une démo, un abonnement ? Notre équipe vous répond. Hébergement HDS en France, données conformes RGPD."
      />
      <DemoForm tone="white" />
    </>
  );
}
