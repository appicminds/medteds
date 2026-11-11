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
  History,
  SearchCheck,
  Images,
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
import { Field, FormMessage, Input, Select } from "@/components/ui/field";
import { Cover } from "@/components/ui/cover";
import { MediaPickerDialog } from "@/components/cms/media-browser";
import { RevisionsDialog, type RevisionRow } from "@/components/cms/revisions-dialog";
import { SeoPanel, seoChecks, type SeoValues } from "@/components/cms/seo-panel";
import { uploadImage } from "@/components/cms/upload";
import {
  publishStory,
  saveStory,
  submitForReview,
  trashStory,
  unpublishStory,
  type SaveInput,
} from "@/lib/post-actions";
import { cn, formatDate } from "@/lib/utils";

type Topic = { id: number; name: string };
type Writer = { id: string; name: string };

export type EditorStory = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  content: JSONContent | null;
  coverImage: string | null;
  status: string;
  topicIds: number[];
  seoTitle: string | null;
  seoDescription: string | null;
  noindex: boolean;
  canonicalUrl: string | null;
  authorId: string;
  featured: boolean;
  publishedAt: string | null;
};

type SaveState = "saved" | "saving" | "unsaved" | "error";

const STATUS_BADGE: Record<string, { label: string; tone: "success" | "neutral" | "warning" | "accent" | "danger" }> = {
  published: { label: "Published", tone: "success" },
  scheduled: { label: "Scheduled", tone: "accent" },
  pending: { label: "Pending review", tone: "warning" },
  draft: { label: "Draft", tone: "neutral" },
  trash: { label: "In trash", tone: "danger" },
};

/** "2026-11-11T09:30" in the browser's time zone, for <input type="datetime-local">. */
function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function StoryEditor({
  story,
  topics,
  writers,
  revisions,
  perms,
  siteUrl,
  siteName,
  defaultShareImage,
}: {
  story: EditorStory;
  topics: Topic[];
  writers: Writer[];
  revisions: RevisionRow[];
  perms: { canPublish: boolean; isEditor: boolean };
  siteUrl: string;
  siteName: string;
  defaultShareImage: string | null;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(story.title);
  const [subtitle, setSubtitle] = useState(story.subtitle ?? "");
  const [cover, setCover] = useState<string | null>(story.coverImage);
  const [topicIds, setTopicIds] = useState<number[]>(story.topicIds);
  const [slug, setSlug] = useState(story.slug.startsWith("draft-") ? "" : story.slug);
  const [seoTitle, setSeoTitle] = useState(story.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(story.seoDescription ?? "");
  const [noindex, setNoindex] = useState(story.noindex);
  const [canonicalUrl, setCanonicalUrl] = useState(story.canonicalUrl ?? "");
  const [seoOpen, setSeoOpen] = useState(false);
  const [authorId, setAuthorId] = useState(story.authorId);
  const [featured, setFeatured] = useState(story.featured);
  const [when, setWhen] = useState<"now" | "later">(story.status === "scheduled" ? "later" : "now");
  const [publishAt, setPublishAt] = useState(() =>
    toLocalInput(story.status === "scheduled" && story.publishedAt ? new Date(story.publishedAt) : new Date(Date.now() + 86_400_000)),
  );
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const [picker, setPicker] = useState<null | "body" | "cover">(null);
  const [confirmTrash, setConfirmTrash] = useState(false);
  const [busy, startBusy] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tiptap keeps the callbacks from its first render, so they reach current values through refs.
  const editorRef = useRef<Editor | null>(null);
  const scheduleRef = useRef<() => void>(() => {});
  const status = story.status;
  const isLiveOrScheduled = status === "published" || status === "scheduled";
  const contributorLocked = !perms.canPublish && status === "pending";

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
      handleDrop: (_view, event) => {
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

  const latest = useRef({ title, subtitle, cover, topicIds, slug, seoTitle, seoDescription, noindex, canonicalUrl, authorId, featured });
  useEffect(() => {
    latest.current = { title, subtitle, cover, topicIds, slug, seoTitle, seoDescription, noindex, canonicalUrl, authorId, featured };
  }, [title, subtitle, cover, topicIds, slug, seoTitle, seoDescription, noindex, canonicalUrl, authorId, featured]);

  const payload = useCallback((): SaveInput => {
    const l = latest.current;
    return {
      id: story.id,
      title: l.title,
      subtitle: l.subtitle,
      coverImage: l.cover,
      topicIds: l.topicIds,
      slug: l.slug || null,
      seoTitle: l.seoTitle || null,
      seoDescription: l.seoDescription || null,
      noindex: l.noindex,
      canonicalUrl: l.canonicalUrl.trim() || null,
      authorId: perms.isEditor ? l.authorId : null,
      featured: perms.isEditor ? l.featured : undefined,
      // ProseMirror builds attrs with a null prototype; a JSON round-trip makes them plain objects React can send.
      content: JSON.parse(JSON.stringify(editorRef.current?.getJSON() ?? { type: "doc", content: [] })) as JSONContent,
    };
  }, [story.id, perms.isEditor]);

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

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (saveState === "unsaved" || saveState === "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  // Ctrl/Cmd+S saves now.
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

  function run(fn: () => Promise<{ ok: boolean; error?: string; message?: string; slug?: string; scheduled?: boolean }>, after?: (r: { slug?: string; scheduled?: boolean }) => void) {
    setError(null);
    setNotice(null);
    if (timer.current) clearTimeout(timer.current);
    startBusy(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? "Something went wrong. Try again.");
        return;
      }
      setSaveState("saved");
      if (after) after(res);
      else {
        setNotice(res.message ?? null);
        setPanelOpen(false);
        router.refresh();
      }
    });
  }

  function onPrimary() {
    if (!perms.canPublish) {
      run(() => submitForReview(payload()));
      return;
    }
    const at = when === "later" ? new Date(publishAt) : null;
    if (at && Number.isNaN(at.getTime())) return setError("Pick a valid date and time.");
    run(
      () => publishStory(payload(), at ? at.toISOString() : null),
      (res) => {
        if (res.scheduled) {
          setNotice(`Scheduled to go live ${at!.toLocaleString()}.`);
          setPanelOpen(false);
          router.refresh();
        } else {
          router.push(`/p/${res.slug}`);
          router.refresh();
        }
      },
    );
  }

  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.draft;
  const statusText = { saved: "Saved", saving: "Saving…", unsaved: "Unsaved changes", error: "Not saved" }[saveState];
  const primaryLabel = !perms.canPublish
    ? "Submit for review"
    : status === "published"
      ? "Update"
      : when === "later"
        ? "Schedule"
        : "Publish";
  const host = siteUrl.replace(/^https?:\/\//, "");
  const hasSlug = !story.slug.startsWith("draft-");
  const seoValues: SeoValues = { slug, seoTitle, seoDescription, noindex, canonicalUrl };
  const seoTodo = seoChecks({ ...seoValues, title, subtitle, hasImage: !!(cover || defaultShareImage), topicCount: topicIds.length, hasSlug }).filter((c) => !c.ok).length;
  const changeSeo = (patch: Partial<SeoValues>) => {
    if (patch.slug !== undefined) setSlug(patch.slug);
    if (patch.seoTitle !== undefined) setSeoTitle(patch.seoTitle);
    if (patch.seoDescription !== undefined) setSeoDescription(patch.seoDescription);
    if (patch.noindex !== undefined) setNoindex(patch.noindex);
    if (patch.canonicalUrl !== undefined) setCanonicalUrl(patch.canonicalUrl);
    scheduleSave();
  };

  return (
    <div className="mx-auto max-w-[760px] px-4 pb-24 sm:px-6">
      {/* Editor header */}
      <div className="sticky top-[57px] z-30 -mx-4 flex flex-wrap items-center gap-3 border-b border-line bg-bg px-4 py-3 sm:-mx-6 sm:px-6">
        <Badge tone={badge.tone}>{badge.label}</Badge>
        <span className={cn("text-sm", saveState === "error" ? "text-danger" : "text-muted")} aria-live="polite">
          {statusText}
        </span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => setRevisionsOpen(true)}
          className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-muted hover:text-fg"
        >
          <History size={16} /> <span className="hidden sm:inline">Revisions</span> ({revisions.length})
        </button>
        <button
          type="button"
          onClick={() => setSeoOpen(true)}
          className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-muted hover:text-fg"
          aria-label={seoTodo ? `SEO, ${seoTodo} suggestion${seoTodo === 1 ? "" : "s"}` : "SEO"}
        >
          <SearchCheck size={16} /> SEO
          {seoTodo ? (
            <span className="grid h-4 min-w-4 place-items-center rounded-pill bg-warning-soft px-1 text-[10px] font-semibold text-warning" aria-hidden>
              {seoTodo}
            </span>
          ) : null}
        </button>
        <Link href={`/p/${story.slug}`} target="_blank" className="text-sm text-muted hover:text-fg">
          Preview
        </Link>
        <Button variant="accent" size="sm" onClick={() => setPanelOpen(true)} disabled={contributorLocked}>
          {contributorLocked ? "In review" : primaryLabel}
        </Button>
      </div>

      <Toolbar editor={editor} onImage={insertImageFile} onLibrary={() => setPicker("body")} />

      {status === "scheduled" && story.publishedAt ? (
        <div className="mt-4 rounded-md bg-accent-soft px-4 py-3 text-sm text-accent">
          Scheduled to go live {formatDate(story.publishedAt, { year: true })} at{" "}
          {new Date(story.publishedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.
        </div>
      ) : null}
      {status === "pending" ? (
        <div className="mt-4 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning">
          {perms.canPublish ? "This story is waiting for review. Publish it when it's ready." : "Submitted for review. An editor will publish it."}
        </div>
      ) : null}
      {notice && !panelOpen ? (
        <div className="mt-4">
          <FormMessage tone="success">{notice}</FormMessage>
        </div>
      ) : null}
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
                {!perms.canPublish ? "Submit for review" : status === "published" ? "Update story" : "Ready to publish?"}
              </h2>
              <button type="button" aria-label="Close" onClick={() => setPanelOpen(false)} className="cursor-pointer text-muted hover:text-fg">
                <X size={22} />
              </button>
            </div>

            <div className="mt-6 flex flex-col gap-7">
              <section>
                <h3 className="mb-2 text-sm font-medium">Story preview image</h3>
                <div className="flex flex-wrap items-center gap-4">
                  <Cover src={cover} seed={story.id} className="h-24 w-36 rounded-sm" />
                  <div className="flex flex-col items-start gap-2 text-sm">
                    <label className="cursor-pointer text-accent hover:underline">
                      Upload image
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
                    <button type="button" className="cursor-pointer text-accent hover:underline" onClick={() => setPicker("cover")}>
                      Choose from library
                    </button>
                    {cover ? (
                      <button
                        type="button"
                        className="cursor-pointer text-muted hover:text-fg"
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
                {topics.length ? (
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
                ) : (
                  <p className="text-sm text-muted">No topics yet. An editor can add them in Admin → Topics.</p>
                )}
              </section>

              {perms.canPublish && status !== "published" ? (
                <section>
                  <h3 className="mb-2 text-sm font-medium">When</h3>
                  <div className="flex flex-col gap-2 text-sm" role="radiogroup" aria-label="When to publish">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input type="radio" name="when" checked={when === "now"} onChange={() => setWhen("now")} className="accent-[var(--accent)]" />
                      Publish now
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input type="radio" name="when" checked={when === "later"} onChange={() => setWhen("later")} className="accent-[var(--accent)]" />
                      Schedule for later
                    </label>
                    {when === "later" ? (
                      <div className="pl-6">
                        <label htmlFor="publish-at" className="sr-only">Publish date and time</label>
                        <Input id="publish-at" type="datetime-local" value={publishAt} min={toLocalInput(new Date())} onChange={(e) => setPublishAt(e.target.value)} className="w-auto" />
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : null}

              <section className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line px-4 py-3">
                <div className="min-w-0 text-sm">
                  <p className="font-medium">SEO and sharing</p>
                  <p className="text-muted">
                    {noindex ? "Hidden from search engines." : seoTodo ? `${seoTodo} suggestion${seoTodo === 1 ? "" : "s"} to improve how this story shows in search.` : "Ready for search and sharing."}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPanelOpen(false);
                    setSeoOpen(true);
                  }}
                >
                  Edit SEO
                </Button>
              </section>

              {perms.isEditor ? (
                <section className="flex flex-col gap-4">
                  <Field label="Author" htmlFor="story-author">
                    <Select id="story-author" value={authorId} onChange={(e) => { setAuthorId(e.target.value); scheduleSave(); }}>
                      {writers.map((w) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </Select>
                  </Field>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" checked={featured} onChange={(e) => { setFeatured(e.target.checked); scheduleSave(); }} className="h-4 w-4 accent-[var(--accent)]" />
                    Show in Editor&apos;s picks
                  </label>
                </section>
              ) : null}

              {error ? <FormMessage tone="error">{error}</FormMessage> : null}

              <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
                <Button variant="accent" onClick={onPrimary} disabled={busy}>
                  {busy ? "Working…" : primaryLabel === "Update" ? "Save and update" : primaryLabel === "Publish" ? "Publish now" : primaryLabel}
                </Button>
                <Button variant="ghost" onClick={() => setPanelOpen(false)}>
                  Keep editing
                </Button>
                <span className="flex-1" />
                {isLiveOrScheduled || status === "pending" ? (
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => run(async () => { await unpublishStory(story.id); return { ok: true, message: "Moved to drafts." }; })}>
                    Move to drafts
                  </Button>
                ) : null}
                {confirmTrash ? (
                  <span className="flex items-center gap-2">
                    <span className="text-sm text-danger">Move to trash?</span>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() =>
                        run(
                          async () => {
                            await trashStory(story.id);
                            return { ok: true };
                          },
                          () => router.push("/me/stories?tab=trash"),
                        )
                      }
                    >
                      Yes
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmTrash(false)}>
                      No
                    </Button>
                  </span>
                ) : (
                  <Button variant="danger-outline" size="sm" onClick={() => setConfirmTrash(true)}>
                    Move to trash
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <SeoPanel
        open={seoOpen}
        onClose={() => setSeoOpen(false)}
        values={seoValues}
        onChange={changeSeo}
        title={title}
        subtitle={subtitle}
        image={cover || defaultShareImage}
        topicCount={topicIds.length}
        hasSlug={hasSlug}
        host={host}
        siteName={siteName}
      />

      <RevisionsDialog
        open={revisionsOpen}
        onClose={() => setRevisionsOpen(false)}
        revisions={revisions}
        getPayload={payload}
        onRestored={() => window.location.reload()}
      />

      <MediaPickerDialog
        open={picker !== null}
        onClose={() => setPicker(null)}
        title={picker === "cover" ? "Choose a preview image" : "Insert an image"}
        onSelect={(item) => {
          if (picker === "cover") {
            setCover(item.url);
            scheduleSave();
          } else {
            editorRef.current?.chain().focus().setImage({ src: item.url, alt: item.alt }).run();
          }
        }}
      />
    </div>
  );
}

function autoGrow(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

export function Toolbar({ editor, onImage, onLibrary }: { editor: Editor | null; onImage: (f: File) => void; onLibrary: () => void }) {
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
    { label: "Image from library", icon: <Images size={17} />, run: onLibrary },
    { label: "Undo", icon: <Undo2 size={17} />, disabled: !state.canUndo, run: () => editor.chain().focus().undo().run() },
    { label: "Redo", icon: <Redo2 size={17} />, disabled: !state.canRedo, run: () => editor.chain().focus().redo().run() },
  ];

  return (
    <div role="toolbar" aria-label="Formatting" className="sticky top-[118px] z-20 -mx-1 mt-2 flex flex-wrap gap-0.5 bg-bg py-1">
      {items.map((i) => (
        <button
          key={i.label}
          type="button"
          title={i.label}
          aria-label={i.label}
          aria-pressed={i.active}
          disabled={i.disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={i.run}
          className={btn(!!i.active)}
        >
          {i.icon}
        </button>
      ))}
      <label title="Upload image" className={btn(false) + " has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent"}>
        <ImagePlus size={17} aria-hidden />
        <span className="sr-only">Upload image</span>
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
