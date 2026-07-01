import type { Metadata } from "next";
import { PageHero } from "@/components/Sections";
import { Blog } from "@/components/Sections2";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Conseils et actualités pour les podologues : suivi du pied diabétique, orthèses plantaires, posturologie et bonnes pratiques de cabinet.",
  alternates: { canonical: "/blog" },
};

export default function BlogPage() {
  return (
    <>
      <PageHero
        kicker="Blog"
        title="Conseils et expertise pour votre pratique"
        lead="Suivi du pied diabétique, orthèses plantaires, posturologie et bonnes pratiques de cabinet, par l'équipe MediCare Pro."
      />
      <Blog tone="white" />
    </>
  );
}
