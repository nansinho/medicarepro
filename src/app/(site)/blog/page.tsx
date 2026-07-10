import type { Metadata } from "next";
import { PageHero } from "@/components/Sections";
import { Blog } from "@/components/Sections2";
import { getPosts } from "@/lib/cms/posts";
import { pageMetadata } from "@/lib/cms/seo";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/blog");
}

export default async function BlogPage() {
  const posts = await getPosts();
  return (
    <>
      <PageHero
        kicker="Blog"
        title="Conseils et expertise pour votre pratique"
        lead="Suivi du pied diabétique, orthèses plantaires, posturologie et bonnes pratiques de cabinet, par l'équipe MediCare Pro."
        image="/images/fonctionnalites/podologue-medicarepro-section-3.jpg"
      />
      <Blog tone="white" posts={posts} />
    </>
  );
}
