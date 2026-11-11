"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import type { JSONContent } from "@tiptap/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/field";
import { DeletePageButton } from "@/components/admin/page-actions";
import { MediaPickerDialog } from "@/components/cms/media-browser";
import { Toolbar } from "@/components/cms/story-editor";
import { uploadImage } from "@/components/cms/upload";
import { savePage } from "@/lib/site-actions";
import { slugify } from "@/lib/usernames-client";

type PageData = {
  id: string;
  title: string;
  slug: string;
  content: JSONContent | null;
  status: "draft" | "published";
  seoTitle: string;
  seoDescription: string;
  noindex: boolean;
};

export function PageEditor({ page, siteUrl }: { page: PageData; siteUrl: string }) {
  const router = useRouter();
  const [title, setTitle] = useState(page.title);
  const [slug, setSlug] = useState(page.slug);
  const [slugTouched, setSlugTouched] = useState(!!page.slug);
  const [seoTitle, setSeoTitle] = useState(page.seoTitle);
  const [seoDescription, setSeoDescription] = useState(page.seoDescription);
  const [noindex, setNoindex] = useState(page.noindex);
  const [status, setStatus] = useState(page.status);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [picker, setPicker] = useState(false);
  const [pending, start] = useTransition();
  const editorRef = useRef<Editor | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false } }), Image, Placeholder.configure({ placeholder: "Write the page…" })],
    content: page.content ?? undefined,
    editorProps: { attributes: { class: "prose-story min-h-[40vh] pb-16", "aria-label": "Page content" } },
    onUpdate: () => setDirty(true),
  });
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function save(nextStatus: "draft" | "published") {
    setMsg(null);
    start(async () => {
      const res = await savePage({
        id: page.id,
        title,
        slug: slug || title,
        status: nextStatus,
        seoTitle,
        seoDescription,
        noindex,
        content: JSON.parse(JSON.stringify(editorRef.current?.getJSON() ?? { type: "doc", content: [] })),
      });
      if (!res.ok) return setMsg({ ok: false, text: res.error });
      setStatus(nextStatus);
      if (res.slug) setSlug(res.slug);
      setDirty(false);
      setMsg({ ok: true, text: res.message ?? "Saved." });
      router.refresh();
    });
  }

  async function insertFile(f: File) {
    const res = await uploadImage(f);
    if ("error" in res) setMsg({ ok: false, text: res.error });
    else editorRef.current?.chain().focus().setImage({ src: res.url, alt: "" }).run();
  }

  const host = siteUrl.replace(/^https?:\/\//, "");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/pages" className="text-sm text-muted hover:text-fg">← All pages</Link>
        <Badge tone={status === "published" ? "success" : "neutral"}>{status === "published" ? "Published" : "Draft"}</Badge>
        {dirty ? <span className="text-sm text-muted">Unsaved changes</span> : null}
        <span className="flex-1" />
        {slug ? (
          <Link href={`/${slug}`} target="_blank" className="text-sm text-muted hover:text-fg">
            {status === "published" ? "View page" : "Preview"}
          </Link>
        ) : null}
        {status === "published" ? (
          <>
            <Button variant="outline" size="sm" disabled={pending} onClick={() => save("draft")}>Unpublish</Button>
            <Button variant="accent" size="sm" disabled={pending} onClick={() => save("published")}>{pending ? "Saving…" : "Update"}</Button>
          </>
        ) : (
          <>
            <Button variant="outline" size="sm" disabled={pending} onClick={() => save("draft")}>Save draft</Button>
            <Button variant="accent" size="sm" disabled={pending} onClick={() => save("published")}>{pending ? "Saving…" : "Publish"}</Button>
          </>
        )}
      </div>
      {msg ? <FormMessage tone={msg.ok ? "success" : "error"}>{msg.text}</FormMessage> : null}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <label htmlFor="page-title" className="sr-only">Title</label>
          <input
            id="page-title"
            value={title}
            maxLength={120}
            placeholder="Page title"
            onChange={(e) => {
              setTitle(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
              setDirty(true);
            }}
            className="w-full bg-transparent text-3xl font-bold tracking-tight outline-none placeholder:text-muted/60 sm:text-4xl"
          />
          <Toolbar editor={editor} onImage={insertFile} onLibrary={() => setPicker(true)} />
          <div className="mt-4 rounded-md border border-line px-4 pt-4 sm:px-6">
            <EditorContent editor={editor} />
          </div>
        </div>

        <aside className="flex flex-col gap-4 self-start rounded-md border border-line p-4">
          <Field label="Web address" htmlFor="page-slug" hint={`${host}/${slug || "…"}`}>
            <Input
              id="page-slug"
              value={slug}
              maxLength={80}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugTouched(true);
                setDirty(true);
              }}
            />
          </Field>
          <Field label="Search title" htmlFor="page-seo-title" hint={`${seoTitle.length}/70. Leave blank to use the page title.`}>
            <Input id="page-seo-title" value={seoTitle} maxLength={70} onChange={(e) => { setSeoTitle(e.target.value); setDirty(true); }} />
          </Field>
          <Field label="Search description" htmlFor="page-seo-desc" hint={`${seoDescription.length}/160`}>
            <Textarea id="page-seo-desc" value={seoDescription} maxLength={160} onChange={(e) => { setSeoDescription(e.target.value); setDirty(true); }} className="min-h-16" />
          </Field>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input type="checkbox" checked={noindex} onChange={(e) => { setNoindex(e.target.checked); setDirty(true); }} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
            <span>
              Hide from search engines
              <span className="block text-xs text-muted">The page stays public but isn&apos;t listed on Google.</span>
            </span>
          </label>
          <div className="border-t border-line pt-4">
            <DeletePageButton id={page.id} onDeleted={() => router.push("/admin/pages")} />
          </div>
        </aside>
      </div>

      <MediaPickerDialog
        open={picker}
        onClose={() => setPicker(false)}
        title="Insert an image"
        onSelect={(item) => editorRef.current?.chain().focus().setImage({ src: item.url, alt: item.alt }).run()}
      />
    </div>
  );
}
