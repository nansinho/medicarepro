import type { Metadata } from "next";
import { PageHero, About, CrossLinks } from "@/components/Sections";
import { CtaBand } from "@/components/Sections2";

export const metadata: Metadata = {
  title: "À propos",
  description:
    "MediCare Pro, le logiciel de gestion de cabinet conçu par et pour les podologues. Notre mission : centraliser tout votre cabinet dans une seule application.",
  alternates: { canonical: "/a-propos" },
};

export default function AProposPage() {
  return (
    <>
      <PageHero
        kicker="À propos"
        title="Conçu par des podologues, pour des podologues"
        lead="Notre mission : réunir tout ce dont un cabinet de podologie a besoin dans une seule application, simple et conforme."
      />
      <About tone="white" />
      <CrossLinks
        links={[
          { href: "/avantages", label: "Les avantages" },
          { href: "/securite", label: "Sécurité des données" },
          { href: "/bilans", label: "Les bilans podologiques" },
        ]}
      />
      <CtaBand tone="soft" />
    </>
  );
}
