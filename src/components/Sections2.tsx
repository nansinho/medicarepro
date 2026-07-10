import NextImage from "next/image";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "./icons";
import { resolveHref } from "@/lib/appLinks";
import type { SectionContentOf } from "@/lib/cms/sections.schema";
import type { BlogPost } from "@/data/blogPosts";
import s from "./sections2.module.css";

/** Tonalité de fond (alternance blanc/clair/moyen, pilotée par la page). */
type Tone = "white" | "soft" | "medium";
function toneClass(tone: Tone = "white") {
  if (tone === "soft") return "tone-soft";
  if (tone === "medium") return "tone-medium";
  return "tone-white";
}

/* ---------------- CTA BANNER ---------------- */
export function CtaBand({
  tone,
  content,
}: {
  tone?: Tone;
  content: SectionContentOf<"cta_band">;
}) {
  return (
    <section className={`${s.ctaBand} ${toneClass(tone)}`}>
      <div className="wrap">
        <div className={s.ctaInner} data-rv-cta>
          <div>
            <h2>{content.title}</h2>
            <p>{content.text}</p>
          </div>
          <a href={resolveHref(content.cta.href)} className="btn">
            {content.cta.label} <ArrowRight className="ico ar" />
          </a>
          <div className={s.ctaShield}>
            <ShieldCheck width={56} height={56} />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- BLOG ---------------- */
export function Blog({
  as = "h2",
  tone,
  posts,
}: {
  as?: "h1" | "h2";
  tone?: Tone;
  posts: BlogPost[];
}) {
  const H = as;
  return (
    <section className={`${s.blog} ${toneClass(tone)}`}>
      <div className="wrap">
        <div className="sec-head">
          <div className="kicker">Blog</div>
          <H className="sec-title">Nos derniers conseils</H>
        </div>
        <div className={s.blogGrid}>
          {posts.map((post) => (
            <article className={s.post} key={post.slug} data-rv-post>
              <div className={`${s.photo} ${s.pimg}`}>
                <NextImage
                  src={post.image}
                  alt={post.imageAlt}
                  fill
                  sizes="(max-width: 760px) 100vw, (max-width: 1080px) 50vw, 33vw"
                  style={{ objectFit: "cover" }}
                />
              </div>
              <div className={s.pbody}>
                <span className={s.date}>{post.dateDisplay}</span>
                <h3>{post.title}</h3>
                <Link className={s.more} href={`/blog/${post.slug}`}>
                  Lire <ArrowRight width={16} height={16} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
