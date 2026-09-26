import type { Metadata } from "next";
import { Crumb, CrumbJsonLd, Section, Sub, Text, Title } from "@/components/site/Kit";
import { PostCards } from "@/components/site/Blocks";
import { getPosts } from "@/lib/cms/posts";
import { pageMetadata } from "@/lib/cms/seo";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/blog");
}

export default async function BlogPage() {
  const posts = await getPosts();
  const crumbs = [
    { label: "Accueil", href: "/" },
    { label: "Blog", href: "/blog" },
  ];
  return (
    <>
      <Section hero center>
        <Crumb items={crumbs} />
        <CrumbJsonLd items={crumbs} />
        <Title as="h1">Conseils et expertise pour votre pratique</Title>
        <Sub>Le blog de MediCare Pro</Sub>
        <div style={{ marginTop: 18 }}>
          <Text>
            Suivi du pied diabétique, orthèses plantaires, posturologie et bonnes pratiques de cabinet,
            par l&apos;équipe MediCare Pro.
          </Text>
        </div>
      </Section>

      <Section tint="teal" edge={0}>
        {posts.length > 0 ? (
          <PostCards posts={posts} headingLevel="h2" />
        ) : (
          <p style={{ textAlign: "center" }}>Les premiers articles arrivent bientôt.</p>
        )}
      </Section>
    </>
  );
}
