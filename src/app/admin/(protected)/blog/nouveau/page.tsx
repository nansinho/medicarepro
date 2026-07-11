import type { Metadata } from "next";
import PostEditor from "@/components/admin/blog/PostEditor";
import s from "@/components/admin/Admin.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Nouvel article" };

const EMPTY_DOC = { type: "doc", content: [] };

export default function AdminBlogNouveauPage() {
  return (
    <>
      <header className={s.pageHead}>
        <h1 className={s.pageTitle}>Nouvel article</h1>
      </header>
      <PostEditor
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
    </>
  );
}
