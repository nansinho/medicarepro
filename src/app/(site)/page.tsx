import type { Metadata } from "next";
import Hero from "@/components/Hero";
import { Values, About, Features } from "@/components/Sections";
import { CtaBand } from "@/components/Sections2";
import Reviews from "@/components/Reviews";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <>
      <Hero />
      <Values teaserHref="/avantages" tone="white" />
      <About teaserHref="/a-propos" tone="soft" />
      <Features teaserHref="/fonctionnalites" tone="white" />
      <Reviews tone="soft" />
      <CtaBand tone="white" />
    </>
  );
}
