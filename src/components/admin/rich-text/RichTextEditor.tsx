"use client";

import { useCallback, useState, type ReactNode } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapImage from "@tiptap/extension-image";
import {
  Bold,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
} from "lucide-react";
import { PickerPanel } from "@/components/admin/media/ImagePicker";
import type { RichTextVariant } from "@/components/cms/RichTextRenderer";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/* ============================================================
   Éditeur riche UNIQUE du back office, paramétré par variant —
   miroir exact des allowlists du RichTextRenderer :
   - "legal" : H2, gras, liste à puces, lien.
   - "blog"  : + H3, italique, liste numérotée, citation, image.
   Stockage JSON (getJSON) — jamais de HTML en base.
   immediatelyRender:false : obligatoire en SSR Next (hydratation).
   ============================================================ */

export type RichTextEditorProps = {
  value: Record<string, unknown>;
  onChange: (doc: Record<string, unknown>) => void;
  variant: RichTextVariant;
  placeholder?: string;
};

/* Typographie légère de la zone d'édition : lisibilité (titres, gras,
   listes, citations, liens, images) sans le plugin prose. */
const EDITOR_PROSE = cn(
  "min-h-[300px] rounded-md border border-input bg-card p-4 text-sm leading-relaxed text-foreground",
  "[&_[contenteditable]]:min-h-[268px] [&_[contenteditable]]:outline-none",
  "[&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground",
  "[&_h3]:mb-1.5 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground",
  "[&_p]:my-2.5",
  "[&_ul]:my-2.5 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2.5 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1",
  "[&_blockquote]:my-3.5 [&_blockquote]:rounded-r-md [&_blockquote]:border-l-[3px] [&_blockquote]:border-primary [&_blockquote]:bg-secondary/60 [&_blockquote]:px-4 [&_blockquote]:py-2 [&_blockquote]:text-muted-foreground",
  "[&_a]:text-primary [&_a]:underline",
  "[&_img]:my-3.5 [&_img]:max-w-full [&_img]:rounded-lg",
  "[&_img.ProseMirror-selectednode]:outline [&_img.ProseMirror-selectednode]:outline-2 [&_img.ProseMirror-selectednode]:outline-primary",
  "[&_strong]:font-semibold",
);

export default function RichTextEditor({
  value,
  onChange,
  variant,
}: RichTextEditorProps) {
  const blog = variant === "blog";

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: blog ? [2, 3] : [2] },
        italic: blog ? {} : false,
        orderedList: blog ? {} : false,
        blockquote: blog ? {} : false,
        /* Hors allowlist du renderer, quel que soit le variant : */
        strike: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        underline: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
        },
      }),
      ...(blog ? [TiptapImage.configure({ inline: false })] : []),
    ],
    content: value,
    onUpdate: ({ editor: current }) => {
      onChange(current.getJSON() as Record<string, unknown>);
    },
  });

  if (!editor) {
    return (
      <div
        className="min-h-[344px] rounded-md border border-input bg-card"
        aria-busy="true"
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Toolbar editor={editor} blog={blog} />
      <EditorContent editor={editor} className={EDITOR_PROSE} />
    </div>
  );
}

function Toolbar({ editor, blog }: { editor: Editor; blog: boolean }) {
  const [pickingImage, setPickingImage] = useState(false);

  const setLink = useCallback(() => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt(
      "Adresse du lien (vide pour retirer) :",
      previous ?? "https://",
    );
    if (url === null) return;
    if (url.trim() === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }, [editor]);

  const btn = (
    icon: ReactNode,
    active: boolean,
    onClick: () => void,
    title: string,
  ) => (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={cn(active && "bg-secondary text-foreground")}
    >
      {icon}
    </Button>
  );

  const sep = <Separator orientation="vertical" className="mx-0.5 h-5" />;

  return (
    <div
      role="toolbar"
      aria-label="Mise en forme"
      className="flex flex-wrap items-center gap-0.5 rounded-md border border-input bg-card p-1"
    >
      {btn(
        <Heading2 />,
        editor.isActive("heading", { level: 2 }),
        () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        "Sous-titre",
      )}
      {blog &&
        btn(
          <Heading3 />,
          editor.isActive("heading", { level: 3 }),
          () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
          "Sous-sous-titre",
        )}
      {sep}
      {btn(
        <Bold />,
        editor.isActive("bold"),
        () => editor.chain().focus().toggleBold().run(),
        "Gras",
      )}
      {blog &&
        btn(
          <Italic />,
          editor.isActive("italic"),
          () => editor.chain().focus().toggleItalic().run(),
          "Italique",
        )}
      {btn(<Link2 />, editor.isActive("link"), setLink, "Insérer un lien")}
      {sep}
      {btn(
        <List />,
        editor.isActive("bulletList"),
        () => editor.chain().focus().toggleBulletList().run(),
        "Liste à puces",
      )}
      {blog &&
        btn(
          <ListOrdered />,
          editor.isActive("orderedList"),
          () => editor.chain().focus().toggleOrderedList().run(),
          "Liste numérotée",
        )}
      {blog &&
        btn(
          <Quote />,
          editor.isActive("blockquote"),
          () => editor.chain().focus().toggleBlockquote().run(),
          "Citation",
        )}
      {blog && (
        <>
          {sep}
          {btn(
            <ImageIcon />,
            false,
            () => setPickingImage(true),
            "Insérer une image de la médiathèque",
          )}
        </>
      )}
      <div className="ml-auto flex items-center gap-0.5">
        {btn(<Undo2 />, false, () => editor.chain().focus().undo().run(), "Annuler")}
        {btn(<Redo2 />, false, () => editor.chain().focus().redo().run(), "Rétablir")}
      </div>

      {pickingImage && (
        <PickerPanel
          onClose={() => setPickingImage(false)}
          onPick={(row) => {
            editor
              .chain()
              .focus()
              .setImage({ src: row.url ?? row.path, alt: row.alt })
              .run();
            setPickingImage(false);
          }}
        />
      )}
    </div>
  );
}
