"use client";

import { useCallback, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapImage from "@tiptap/extension-image";
import { PickerPanel } from "@/components/admin/media/ImagePicker";
import type { RichTextVariant } from "@/components/cms/RichTextRenderer";
import rt from "./richtext.module.css";

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
    return <div className={rt.editorShell} aria-busy="true" />;
  }

  return (
    <div className={rt.editorShell}>
      <Toolbar editor={editor} blog={blog} />
      <EditorContent editor={editor} className={rt.content} />
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
    label: string,
    active: boolean,
    onClick: () => void,
    title: string,
  ) => (
    <button
      type="button"
      className={`${rt.tbBtn} ${active ? rt.tbActive : ""}`}
      onClick={onClick}
      title={title}
      aria-pressed={active}
    >
      {label}
    </button>
  );

  return (
    <div className={rt.toolbar} role="toolbar" aria-label="Mise en forme">
      {btn(
        "H2",
        editor.isActive("heading", { level: 2 }),
        () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        "Sous-titre",
      )}
      {blog &&
        btn(
          "H3",
          editor.isActive("heading", { level: 3 }),
          () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
          "Sous-sous-titre",
        )}
      <span className={rt.tbSep} />
      {btn(
        "G",
        editor.isActive("bold"),
        () => editor.chain().focus().toggleBold().run(),
        "Gras",
      )}
      {blog &&
        btn(
          "I",
          editor.isActive("italic"),
          () => editor.chain().focus().toggleItalic().run(),
          "Italique",
        )}
      {btn("Lien", editor.isActive("link"), setLink, "Insérer un lien")}
      <span className={rt.tbSep} />
      {btn(
        "• Liste",
        editor.isActive("bulletList"),
        () => editor.chain().focus().toggleBulletList().run(),
        "Liste à puces",
      )}
      {blog &&
        btn(
          "1. Liste",
          editor.isActive("orderedList"),
          () => editor.chain().focus().toggleOrderedList().run(),
          "Liste numérotée",
        )}
      {blog &&
        btn(
          "❝ Citation",
          editor.isActive("blockquote"),
          () => editor.chain().focus().toggleBlockquote().run(),
          "Citation",
        )}
      {blog && (
        <>
          <span className={rt.tbSep} />
          <button
            type="button"
            className={rt.tbBtn}
            onClick={() => setPickingImage(true)}
            title="Insérer une image de la médiathèque"
          >
            Image
          </button>
        </>
      )}
      <span className={rt.tbSpace} />
      {btn("↶", false, () => editor.chain().focus().undo().run(), "Annuler")}
      {btn("↷", false, () => editor.chain().focus().redo().run(), "Rétablir")}

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
