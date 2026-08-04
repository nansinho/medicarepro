import type { Metadata } from "next";
import PostEditor from "@/components/admin/blog/PostEditor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Nouvel article" };

const EMPTY_DOC = { type: "doc", content: [] };

export default function AdminBlogNouveauPage() {
  return (
    <PostEditor
      heading="Nouvel article"
      post={{
        id: null,
        title: "",
        slug: "",
        excerpt: "",
        coverMediaId: null,
        coverPath: "",
        coverAlt: "",
        body: EMPTY_DOC,
        status: "draft",
        scheduledFor: null,
        publishedAt: null,
      }}
    />
  );
}
