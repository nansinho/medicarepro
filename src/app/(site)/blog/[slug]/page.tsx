import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { after } from "next/server";
import { isPermanent, resolveRedirect } from "@/lib/cms/redirects";
import { recordRedirectHit } from "@/lib/cms/seo-log";
import { ChevronLeft } from "@/components/icons";
import RichTextRenderer, { type RichTextBody } from "@/components/cms/RichTextRenderer";
import { Crumb, CrumbJsonLd, Head, Section, Title, fr } from "@/components/site/Kit";
import { CtaBlock, PostCards } from "@/components/site/Blocks";
import { getPageSections, pick } from "@/lib/cms/pages";
import { getPostBySlug, getPosts } from "@/lib/cms/posts";
import p from "@/components/site/prose.module.css";

type Params = { slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  const posts = await getPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.date,
      images: [{ url: post.image }],
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const [post, posts, aProposSections] = await Promise.all([
    getPostBySlug(slug),
    getPosts(),
    /* Bande d'appel transversale : contenu géré sur la page À propos. */
    getPageSections("/a-propos"),
  ]);
  if (!post) {
    /* Slug renommé ? Les redirections gérées s'appliquent aussi ici
       (le catch-all ne voit jamais les routes dynamiques). */
    const managed = await resolveRedirect(`/blog/${slug}`);
    if (managed) {
      after(() => recordRedirectHit(managed.id));
      if (isPermanent(managed)) permanentRedirect(managed.to_path);
      redirect(managed.to_path);
    }
    notFound();
  }

  const related = posts.filter((other) => other.slug !== post.slug).slice(0, 3);
  const ctaBand = pick(aProposSections, "cta_band", "cta_band");
  const crumbs = [
    { label: "Accueil", href: "/" },
    { label: "Blog", href: "/blog" },
    { label: post.title, href: `/blog/${post.slug}` },
  ];

  /* Schema.org Article : aide Google à comprendre et présenter l'article. */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    image: `https://medicarepro.fr${post.image}`,
    datePublished: post.date,
    inLanguage: "fr-FR",
    author: { "@type": "Organization", name: "MediCare Pro" },
    publisher: { "@type": "Organization", name: "MediCare Pro" },
    mainEntityOfPage: `https://medicarepro.fr/blog/${post.slug}`,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Section hero center>
        <Crumb items={crumbs} />
        <CrumbJsonLd items={crumbs} />
        <div style={{ maxWidth: 940, marginInline: "auto" }}>
          <Title as="h1">{post.title}</Title>
        </div>
        <div className={p.meta}>
          <time dateTime={post.date}>{post.dateDisplay}</time>
          <span className={p.metaDot} aria-hidden="true" />
          <span>{post.readingTime} de lecture</span>
        </div>
      </Section>

      <Section tight>
        <div className={p.cover}>
          <Image src={post.image} alt={post.imageAlt} fill priority sizes="(max-width: 1100px) 92vw, 1040px" />
        </div>
        <article className={p.prose} style={{ marginTop: 48 }}>
          {post.body ? (
            /* Corps riche (articles du back office) — allowlist blog. */
            <RichTextRenderer body={post.body as RichTextBody} variant="blog" />
          ) : (
            post.sections.map((section, i) => (
              <section key={section.heading ?? `intro-${i}`}>
                {section.heading && <h2>{fr(section.heading)}</h2>}
                {section.paragraphs.map((para) => (
                  <p key={para.slice(0, 40)}>{fr(para)}</p>
                ))}
                {section.list && (
                  <ul>
                    {section.list.map((item) => (
                      <li key={item.slice(0, 40)}>{fr(item)}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))
          )}
        </article>
        <nav className={p.back} aria-label="Navigation de l'article">
          <Link href="/blog">
            <ChevronLeft aria-hidden="true" /> Tous les articles
          </Link>
        </nav>
      </Section>

      {related.length > 0 && (
        <Section tint="violet" edge={2}>
          <Head eyebrow="À lire aussi" title="Poursuivre la lecture" centered />
          <PostCards posts={related} />
        </Section>
      )}

      <Section tight>
        <CtaBlock
          title={ctaBand.title}
          lead={ctaBand.text}
          primary={ctaBand.cta}
          secondary={{ label: "Demander une démo", href: "/contact" }}
        />
      </Section>
    </>
  );
}
