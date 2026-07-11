import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { after } from "next/server";
import { isPermanent, resolveRedirect } from "@/lib/cms/redirects";
import { recordRedirectHit } from "@/lib/cms/seo-log";
import { CtaBand } from "@/components/Sections2";
import { ChevronLeft, ArrowRight } from "@/components/icons";
import RichTextRenderer, {
  type RichTextBody,
} from "@/components/cms/RichTextRenderer";
import { getPageSections, pick } from "@/lib/cms/pages";
import { getPostBySlug, getPosts } from "@/lib/cms/posts";
import a from "@/components/article.module.css";
import s2 from "@/components/sections2.module.css";

type Params = { slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  const posts = await getPosts();
  return posts.map((p) => ({ slug: p.slug }));
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
    /* Bande CTA transversale : contenu géré sur la page À propos. */
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

  const related = posts.filter((p) => p.slug !== post.slug).slice(0, 2);
  const ctaBand = pick(aProposSections, "cta_band", "cta_band");

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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* En-tête : kicker + titre + méta */}
      <header className={a.head}>
        <div className="wrap">
          <div className={a.headInner}>
            <div className="kicker">Blog</div>
            <h1 className={a.title}>{post.title}</h1>
            <div className={a.meta}>
              <time dateTime={post.date}>{post.dateDisplay}</time>
              <span className={a.metaDot} />
              <span>{post.readingTime} de lecture</span>
            </div>
          </div>
        </div>
      </header>

      {/* Image de couverture */}
      <div className={`wrap ${a.coverWrap}`}>
        <div className={a.cover}>
          <Image
            src={post.image}
            alt={post.imageAlt}
            fill
            preload
            sizes="(max-width: 980px) 100vw, 980px"
          />
        </div>
      </div>

      {/* Corps de l'article */}
      <article className="wrap">
        <div className={a.body}>
          {post.body ? (
            /* Corps riche (articles du back office) — allowlist blog. */
            <RichTextRenderer body={post.body as RichTextBody} variant="blog" />
          ) : (
            post.sections.map((section, i) => (
              <section key={section.heading ?? `intro-${i}`}>
                {section.heading && <h2>{section.heading}</h2>}
                {section.paragraphs.map((p) => (
                  <p key={p.slice(0, 40)}>{p}</p>
                ))}
                {section.list && (
                  <ul>
                    {section.list.map((item) => (
                      <li key={item.slice(0, 40)}>{item}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))
          )}
        </div>
        <nav className={a.footNav} aria-label="Navigation article">
          <Link href="/blog" className={a.backLink}>
            <ChevronLeft width={16} height={16} /> Tous les articles
          </Link>
        </nav>
      </article>

      {/* Autres articles */}
      <section className={`${a.relatedSec} tone-soft`}>
        <div className="wrap">
          <div className="sec-head">
            <div className="kicker">À lire aussi</div>
            <h2 className="sec-title">Poursuivre la lecture</h2>
          </div>
          <div className={s2.blogGrid}>
            {related.map((p) => (
              <article className={s2.post} key={p.slug}>
                <div className={`${s2.photo} ${s2.pimg}`}>
                  <Image
                    src={p.image}
                    alt={p.imageAlt}
                    fill
                    sizes="(max-width: 760px) 100vw, 33vw"
                    style={{ objectFit: "cover" }}
                  />
                </div>
                <div className={s2.pbody}>
                  <span className={s2.date}>{p.dateDisplay}</span>
                  <h3>{p.title}</h3>
                  <Link className={s2.more} href={`/blog/${p.slug}`}>
                    Lire <ArrowRight width={16} height={16} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <CtaBand tone="white" content={ctaBand} />
    </>
  );
}
