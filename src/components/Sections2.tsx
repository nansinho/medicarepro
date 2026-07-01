import NextImage from "next/image";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "./icons";
import { registerUrl } from "@/lib/appLinks";
import s from "./sections2.module.css";

/** Tonalité de fond (alternance blanc/clair/moyen, pilotée par la page). */
type Tone = "white" | "soft" | "medium";
function toneClass(tone: Tone = "white") {
  if (tone === "soft") return "tone-soft";
  if (tone === "medium") return "tone-medium";
  return "tone-white";
}

/* ---------------- CTA BANNER ---------------- */
export function CtaBand({ tone }: { tone?: Tone }) {
  return (
    <section className={`${s.ctaBand} ${toneClass(tone)}`}>
      <div className="wrap">
        <div className={s.ctaInner} data-rv-cta>
          <div>
            <h2>Ne laissez plus l&apos;administratif vous freiner</h2>
            <p>
              Abonnez-vous dès aujourd&apos;hui et centralisez tout votre
              cabinet.
            </p>
          </div>
          <a href={registerUrl("annual")} className="btn">
            Je m&apos;abonne <ArrowRight className="ico ar" />
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
const POSTS = [
  {
    date: "12 juin 2026",
    title: "Pied du diabétique : les bons réflexes de suivi",
    img: "/images/blog-diabete.jpg",
  },
  {
    date: "5 juin 2026",
    title: "Bien choisir ses orthèses plantaires",
    img: "/images/blog-ortheses.jpg",
  },
  {
    date: "28 mai 2026",
    title: "Posturologie : comprendre le bilan",
    img: "/images/blog-posturologie.jpg",
  },
];

export function Blog({
  as = "h2",
  tone,
}: { as?: "h1" | "h2"; tone?: Tone } = {}) {
  const H = as;
  return (
    <section className={`${s.blog} ${toneClass(tone)}`}>
      <div className="wrap">
        <div className="sec-head">
          <div className="kicker">Blog</div>
          <H className="sec-title">Nos derniers conseils</H>
        </div>
        <div className={s.blogGrid}>
          {POSTS.map((post) => (
            <article className={s.post} key={post.title} data-rv-post>
              <div className={`${s.photo} ${s.pimg}`}>
                <NextImage
                  src={post.img}
                  alt={post.title}
                  fill
                  sizes="(max-width: 760px) 100vw, (max-width: 1080px) 50vw, 33vw"
                  style={{ objectFit: "cover" }}
                />
              </div>
              <div className={s.pbody}>
                <span className={s.date}>{post.date}</span>
                <h3>{post.title}</h3>
                <Link className={s.more} href="/blog">
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
