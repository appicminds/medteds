"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import type { JSONContent } from "@tiptap/core";
import {
  Bold,
  Code2,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Undo2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormMessage } from "@/components/ui/field";
import { Cover } from "@/components/ui/cover";
import { publishStory, saveStory, deleteStory, unpublishStory } from "@/lib/actions";
import { uploadImage } from "@/components/cms/upload";
import { cn } from "@/lib/utils";

type Topic = { id: number; name: string };

export type EditorStory = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  content: JSONContent | null;
  coverImage: string | null;
  status: string;
  topicIds: number[];
};

type SaveState = "saved" | "saving" | "unsaved" | "error";

export function StoryEditor({ story, topics }: { story: EditorStory; topics: Topic[] }) {
  const router = useRouter();
  const [title, setTitle] = useState(story.title);
  const [subtitle, setSubtitle] = useState(story.subtitle ?? "");
  const [cover, setCover] = useState<string | null>(story.coverImage);
  const [topicIds, setTopicIds] = useState<number[]>(story.topicIds);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [error, setError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [publishing, startPublish] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tiptap keeps the callbacks from its first render, so they reach current values through refs.
  const editorRef = useRef<Editor | null>(null);
  const scheduleRef = useRef<() => void>(() => {});
  const isPublished = story.status === "published";

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      Image,
      Placeholder.configure({ placeholder: "Tell your story…" }),
    ],
    content: story.content ?? undefined,
    editorProps: {
      attributes: { class: "prose-story min-h-[50vh] pb-24", "aria-label": "Story body" },
      handleDrop: (view, event) => {
        const file = event.dataTransfer?.files?.[0];
        if (file?.type.startsWith("image/")) {
          event.preventDefault();
          void insertImageFile(file);
          return true;
        }
        return false;
      },
      handlePaste: (_view, event) => {
        const file = event.clipboardData?.files?.[0];
        if (file?.type.startsWith("image/")) {
          void insertImageFile(file);
          return true;
        }
        return false;
      },
    },
    onUpdate: () => scheduleRef.current(),
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  const latest = useRef({ title, subtitle, cover, topicIds });
  useEffect(() => {
    latest.current = { title, subtitle, cover, topicIds };
  }, [title, subtitle, cover, topicIds]);

  const payload = useCallback(
    () => ({
      id: story.id,
      title: latest.current.title,
      subtitle: latest.current.subtitle,
      coverImage: latest.current.cover,
      topicIds: latest.current.topicIds,
      // ProseMirror builds attrs with a null prototype; a JSON round-trip makes them plain objects React can send.
      content: JSON.parse(JSON.stringify(editorRef.current?.getJSON() ?? { type: "doc", content: [] })) as JSONContent,
    }),
    [story.id],
  );

  const save = useCallback(async () => {
    setSaveState("saving");
    const res = await saveStory(payload());
    if (res.ok) {
      setSaveState("saved");
      setError(null);
    } else {
      setSaveState("error");
      setError(res.error);
    }
  }, [payload]);

  const scheduleSave = useCallback(() => {
    setSaveState("unsaved");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), 1500);
  }, [save]);

  useEffect(() => {
    scheduleRef.current = scheduleSave;
  }, [scheduleSave]);

  // Save pending changes before leaving the page.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (saveState === "unsaved" || saveState === "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  // Keyboard shortcut: Ctrl/Cmd+S saves now.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  async function insertImageFile(file: File) {
    setError(null);
    const res = await uploadImage(file);
    if ("error" in res) return setError(res.error);
    editorRef.current?.chain().focus().setImage({ src: res.url, alt: "" }).run();
  }

  function onPublish() {
    setError(null);
    if (timer.current) clearTimeout(timer.current);
    startPublish(async () => {
      const res = await publishStory(payload());
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/p/${res.slug}`);
      router.refresh();
    });
  }

  const statusText = { saved: "Saved", saving: "Saving…", unsaved: "Unsaved changes", error: "Not saved" }[saveState];

  return (
    <div className="mx-auto max-w-[760px] px-4 pb-24 sm:px-6">
      {/* Editor header */}
      <div className="sticky top-[57px] z-30 -mx-4 flex flex-wrap items-center gap-3 border-b border-line bg-bg px-4 py-3 sm:-mx-6 sm:px-6">
        <Badge tone={isPublished ? "success" : "neutral"}>{isPublished ? "Published" : "Draft"}</Badge>
        <span className={cn("text-sm", saveState === "error" ? "text-danger" : "text-muted")} aria-live="polite">
          {statusText}
        </span>
        <span className="flex-1" />
        <Link href={`/p/${story.slug}`} target="_blank" className="text-sm text-muted hover:text-fg">
          Preview
        </Link>
        <Button variant="accent" size="sm" onClick={() => setPanelOpen(true)}>
          {isPublished ? "Update" : "Publish"}
        </Button>
      </div>

      <Toolbar editor={editor} onImage={insertImageFile} />

      {error && !panelOpen ? (
        <div className="mt-4">
          <FormMessage tone="error">{error}</FormMessage>
        </div>
      ) : null}

      <div className="mt-8 flex flex-col gap-2">
        <label htmlFor="story-title" className="sr-only">Title</label>
        <textarea
          id="story-title"
          rows={1}
          value={title}
          maxLength={200}
          placeholder="Title"
          onChange={(e) => {
            setTitle(e.target.value);
            scheduleSave();
          }}
          onInput={(e) => autoGrow(e.currentTarget)}
          ref={(el) => {
            if (el) autoGrow(el);
          }}
          className="w-full resize-none overflow-hidden bg-transparent text-3xl font-bold tracking-tight outline-none placeholder:text-muted/60 sm:text-4xl"
        />
        <label htmlFor="story-subtitle" className="sr-only">Subtitle</label>
        <textarea
          id="story-subtitle"
          rows={1}
          value={subtitle}
          maxLength={300}
          placeholder="Subtitle (optional)"
          onChange={(e) => {
            setSubtitle(e.target.value);
            scheduleSave();
          }}
          onInput={(e) => autoGrow(e.currentTarget)}
          ref={(el) => {
            if (el) autoGrow(el);
          }}
          className="w-full resize-none overflow-hidden bg-transparent text-xl text-muted outline-none placeholder:text-muted/60"
        />
      </div>

      <div className="mt-6">
        <EditorContent editor={editor} />
      </div>

      {/* Publish panel */}
      {panelOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-fg/40 px-4 py-10" role="dialog" aria-modal="true" aria-labelledby="publish-title">
          <div className="w-full max-w-xl rounded-lg bg-bg p-6 shadow-pop sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <h2 id="publish-title" className="text-2xl font-bold">
                {isPublished ? "Update story" : "Ready to publish?"}
              </h2>
              <button type="button" aria-label="Close" onClick={() => setPanelOpen(false)} className="cursor-pointer text-muted hover:text-fg">
                <X size={22} />
              </button>
            </div>

            <div className="mt-6 flex flex-col gap-6">
              <section>
                <h3 className="mb-2 text-sm font-medium">Story preview image</h3>
                <div className="flex flex-wrap items-center gap-4">
                  <Cover src={cover} seed={story.id} className="h-24 w-36 rounded-sm" />
                  <div className="flex flex-col gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-accent hover:underline">
                      <ImagePlus size={16} /> {cover ? "Change image" : "Upload image"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="sr-only"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          const res = await uploadImage(f);
                          if ("error" in res) setError(res.error);
                          else {
                            setCover(res.url);
                            scheduleSave();
                          }
                        }}
                      />
                    </label>
                    {cover ? (
                      <button
                        type="button"
                        className="cursor-pointer text-left text-sm text-muted hover:text-fg"
                        onClick={() => {
                          setCover(null);
                          scheduleSave();
                        }}
                      >
                        Remove image
                      </button>
                    ) : (
                      <p className="text-xs text-muted">Without one, the first image in your story is used.</p>
                    )}
                  </div>
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-medium">
                  Topics <span className="font-normal text-muted">({topicIds.length}/5)</span>
                </h3>
                <p className="mb-3 text-xs text-muted">Topics help readers find your story. The first one is shown on the story card.</p>
                <div className="flex flex-wrap gap-2">
                  {topics.map((t) => {
                    const on = topicIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        aria-pressed={on}
                        disabled={!on && topicIds.length >= 5}
                        onClick={() => {
                          setTopicIds((ids) => (on ? ids.filter((i) => i !== t.id) : [...ids, t.id]));
                          scheduleSave();
                        }}
                        className={cn(
                          "cursor-pointer rounded-pill px-3.5 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                          on ? "bg-fg text-bg" : "bg-surface hover:bg-surface-2",
                        )}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </section>

              {error ? <FormMessage tone="error">{error}</FormMessage> : null}

              <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
                <Button variant="accent" onClick={onPublish} disabled={publishing}>
                  {publishing ? "Publishing…" : isPublished ? "Save and update" : "Publish now"}
                </Button>
                <Button variant="ghost" onClick={() => setPanelOpen(false)}>
                  Keep editing
                </Button>
                <span className="flex-1" />
                {isPublished ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await unpublishStory(story.id);
                      router.refresh();
                      setPanelOpen(false);
                    }}
                  >
                    Unpublish
                  </Button>
                ) : null}
                {confirmDelete ? (
                  <span className="flex items-center gap-2">
                    <span className="text-sm text-danger">Delete for good?</span>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={async () => {
                        await deleteStory(story.id);
                        router.push("/me/stories");
                      }}
                    >
                      Delete
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                      Cancel
                    </Button>
                  </span>
                ) : (
                  <Button variant="danger-outline" size="sm" onClick={() => setConfirmDelete(true)}>
                    Delete story
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function autoGrow(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

function Toolbar({ editor, onImage }: { editor: Editor | null; onImage: (f: File) => void }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            h2: e.isActive("heading", { level: 2 }),
            h3: e.isActive("heading", { level: 3 }),
            quote: e.isActive("blockquote"),
            ul: e.isActive("bulletList"),
            ol: e.isActive("orderedList"),
            code: e.isActive("codeBlock"),
            link: e.isActive("link"),
            canUndo: e.can().undo(),
            canRedo: e.can().redo(),
          }
        : null,
  });
  if (!editor || !state) return <div className="h-12" />;

  const btn = (active: boolean) =>
    cn(
      "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-sm transition-colors disabled:opacity-30",
      active ? "bg-fg text-bg" : "text-muted hover:bg-surface hover:text-fg",
    );

  const items: { label: string; icon: React.ReactNode; active?: boolean; disabled?: boolean; run: () => void }[] = [
    { label: "Bold", icon: <Bold size={17} />, active: state.bold, run: () => editor.chain().focus().toggleBold().run() },
    { label: "Italic", icon: <Italic size={17} />, active: state.italic, run: () => editor.chain().focus().toggleItalic().run() },
    { label: "Heading", icon: <Heading2 size={17} />, active: state.h2, run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: "Subheading", icon: <Heading3 size={17} />, active: state.h3, run: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    { label: "Quote", icon: <Quote size={17} />, active: state.quote, run: () => editor.chain().focus().toggleBlockquote().run() },
    { label: "Bulleted list", icon: <List size={17} />, active: state.ul, run: () => editor.chain().focus().toggleBulletList().run() },
    { label: "Numbered list", icon: <ListOrdered size={17} />, active: state.ol, run: () => editor.chain().focus().toggleOrderedList().run() },
    { label: "Code block", icon: <Code2 size={17} />, active: state.code, run: () => editor.chain().focus().toggleCodeBlock().run() },
    {
      label: state.link ? "Remove link" : "Add link",
      icon: <Link2 size={17} />,
      active: state.link,
      run: () => {
        if (state.link) return editor.chain().focus().unsetLink().run();
        const url = window.prompt("Link address (https://…)");
        if (url) editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
      },
    },
    { label: "Divider", icon: <Minus size={17} />, run: () => editor.chain().focus().setHorizontalRule().run() },
    { label: "Undo", icon: <Undo2 size={17} />, disabled: !state.canUndo, run: () => editor.chain().focus().undo().run() },
    { label: "Redo", icon: <Redo2 size={17} />, disabled: !state.canRedo, run: () => editor.chain().focus().redo().run() },
  ];

  return (
    <div role="toolbar" aria-label="Formatting" className="sticky top-[118px] z-20 -mx-1 mt-2 flex flex-wrap gap-0.5 bg-bg py-1">
      {items.map((i) => (
        <button key={i.label} type="button" title={i.label} aria-label={i.label} aria-pressed={i.active} disabled={i.disabled} onMouseDown={(e) => e.preventDefault()} onClick={i.run} className={btn(!!i.active)}>
          {i.icon}
        </button>
      ))}
      <label title="Add image" className={btn(false) + " has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent"}>
        <ImagePlus size={17} aria-hidden />
        <span className="sr-only">Add image</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImage(f);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}
