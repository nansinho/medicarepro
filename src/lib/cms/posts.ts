import { unstable_cache } from "next/cache";
import { BLOG_POSTS } from "./fallback";
import { TAGS, CACHE_SAFETY_REVALIDATE } from "./tags";
import { publicClient } from "@/lib/supabase/public";
import type { BlogPost, BlogSection } from "@/data/blogPosts";

/* ============================================================
   Articles de blog.
   Phase 1 : les rows DB portent le contenu d'origine dans
   `body_legacy` (BlogSection[]) → rendu strictement identique à
   l'existant. Le rendu du `body` Tiptap arrive avec l'éditeur
   (Phase 4). Fallback : les 3 articles embarqués.
   ============================================================ */

type PostRow = {
  slug: string;
  title: string;
  excerpt: string;
  cover_alt: string;
  published_at: string;
  reading_time_min: number;
  body_legacy: unknown;
  cover_media_id: string | null;
};

const DATE_FR = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function isSectionArray(value: unknown): value is BlogSection[] {
  return (
    Array.isArray(value) &&
    value.every(
      (s) =>
        s &&
        typeof s === "object" &&
        Array.isArray((s as BlogSection).paragraphs),
    )
  );
}

async function fetchPublishedPosts(): Promise<BlogPost[] | null> {
  const sb = publicClient();
  if (!sb) return null;

  const { data, error } = await sb
    .from("posts")
    .select(
      "slug, title, excerpt, cover_alt, published_at, reading_time_min, body_legacy, cover_media_id",
    )
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false });
  if (error || !data || data.length === 0) return null;

  /* Couvertures : résolution des media référencés (2e requête simple,
     plus robuste qu'un join dépendant du nom de la contrainte FK). */
  const mediaIds = data
    .map((row) => (row as PostRow).cover_media_id)
    .filter((id): id is string => Boolean(id));
  const covers = new Map<string, string>();
  if (mediaIds.length > 0) {
    const { data: media } = await sb
      .from("media")
      .select("id, url")
      .in("id", mediaIds);
    for (const m of media ?? []) covers.set(m.id, m.url);
  }

  const posts: BlogPost[] = [];
  for (const raw of data as PostRow[]) {
    if (!isSectionArray(raw.body_legacy)) continue; // rendu Tiptap : Phase 4
    const published = new Date(raw.published_at);
    posts.push({
      slug: raw.slug,
      title: raw.title,
      date: raw.published_at.slice(0, 10),
      dateDisplay: DATE_FR.format(published),
      image: (raw.cover_media_id && covers.get(raw.cover_media_id)) || "",
      imageAlt: raw.cover_alt,
      excerpt: raw.excerpt,
      readingTime: `${raw.reading_time_min} min`,
      sections: raw.body_legacy,
    });
  }
  return posts.length > 0 ? posts : null;
}

/** Tous les articles publiés (du plus récent au plus ancien). */
export async function getPosts(): Promise<BlogPost[]> {
  const sb = publicClient();
  if (!sb) return BLOG_POSTS;
  try {
    const posts = await unstable_cache(fetchPublishedPosts, ["cms-posts"], {
      tags: [TAGS.posts],
      revalidate: CACHE_SAFETY_REVALIDATE,
    })();
    return posts ?? BLOG_POSTS;
  } catch {
    return BLOG_POSTS;
  }
}

/** Un article par slug (undefined si inexistant/non publié). */
export async function getPostBySlug(
  slug: string,
): Promise<BlogPost | undefined> {
  const posts = await getPosts();
  return posts.find((post) => post.slug === slug);
}
