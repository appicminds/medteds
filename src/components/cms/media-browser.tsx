"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Check, Copy, ImagePlus, Search, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/field";
import { uploadImage } from "@/components/cms/upload";
import { deleteMedia, listMedia, mediaUsage, updateMediaAlt, type MediaItem } from "@/lib/media-actions";
import { cn, formatDate } from "@/lib/utils";

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * The media library. In "page" mode it manages images; in "picker" mode
 * selecting an image calls onSelect so the editor can insert it.
 */
export function MediaBrowser({
  mode,
  onSelect,
}: {
  mode: "page" | "picker";
  onSelect?: (item: { url: string; alt: string }) => void;
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (q: string, p: number, append: boolean) => {
    setLoading(true);
    const res = await listMedia({ query: q, page: p });
    setItems((prev) => (append ? [...prev, ...res.items] : res.items));
    setHasMore(res.hasMore);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      void load(query, 1, false);
    }, 250);
    return () => clearTimeout(t);
  }, [query, load]);

  async function upload(files: FileList | File[]) {
    setError(null);
    const list = [...files].filter((f) => f.type.startsWith("image/"));
    if (!list.length) return setError("Choose JPG, PNG, WebP or GIF images.");
    setUploading(list.length);
    let lastId: string | null = null;
    for (const f of list) {
      const res = await uploadImage(f);
      if ("error" in res) setError(`${f.name}: ${res.error}`);
      else lastId = res.id;
      setUploading((n) => n - 1);
    }
    await load(query, 1, false);
    setPage(1);
    if (lastId) setSelectedId(lastId);
  }

  const selected = items.find((i) => i.id === selectedId) ?? null;

  return (
    <div
      className={cn("grid gap-6", selected ? "lg:grid-cols-[minmax(0,1fr)_300px]" : "")}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length) void upload(e.dataTransfer.files);
      }}
    >
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <label htmlFor={`media-q-${mode}`} className="sr-only">Search images</label>
            <Input
              id={`media-q-${mode}`}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by file name or alt text"
              className="pl-9"
            />
          </div>
          <Button variant="accent" size="md" onClick={() => fileRef.current?.click()} disabled={uploading > 0}>
            <Upload size={16} /> {uploading ? `Uploading ${uploading}…` : "Upload images"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              if (e.target.files?.length) void upload(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}

        <div
          className={cn(
            "rounded-md border border-dashed p-3 transition-colors",
            dragging ? "border-accent bg-accent-soft" : "border-line",
          )}
        >
          {items.length ? (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6" aria-label="Images">
              {items.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(m.id === selectedId ? null : m.id)}
                    aria-pressed={m.id === selectedId}
                    aria-label={m.alt || m.filename || "Image"}
                    className={cn(
                      "relative block aspect-square w-full cursor-pointer overflow-hidden rounded-sm bg-surface ring-offset-2 ring-offset-bg",
                      m.id === selectedId ? "ring-2 ring-accent" : "hover:opacity-85",
                    )}
                  >
                    <img src={m.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                    {m.id === selectedId ? (
                      <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-accent text-accent-fg">
                        <Check size={13} />
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-2 px-4 py-14 text-center text-sm text-muted">
              <ImagePlus size={28} aria-hidden />
              {loading ? "Loading images…" : query ? "No images match your search." : "No images yet. Drag images here or click Upload images."}
            </div>
          )}
        </div>
        {hasMore ? (
          <div>
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => {
                const next = page + 1;
                setPage(next);
                void load(query, next, true);
              }}
            >
              {loading ? "Loading…" : "Load more"}
            </Button>
          </div>
        ) : null}
      </div>

      {selected ? (
        <MediaDetails
          key={selected.id}
          item={selected}
          mode={mode}
          onClose={() => setSelectedId(null)}
          onChanged={(patch) => setItems((all) => all.map((i) => (i.id === selected.id ? { ...i, ...patch } : i)))}
          onDeleted={() => {
            setItems((all) => all.filter((i) => i.id !== selected.id));
            setSelectedId(null);
          }}
          onSelect={onSelect}
        />
      ) : null}
    </div>
  );
}

function MediaDetails({
  item,
  mode,
  onClose,
  onChanged,
  onDeleted,
  onSelect,
}: {
  item: MediaItem;
  mode: "page" | "picker";
  onClose: () => void;
  onChanged: (patch: Partial<MediaItem>) => void;
  onDeleted: () => void;
  onSelect?: (item: { url: string; alt: string }) => void;
}) {
  const [alt, setAlt] = useState(item.alt);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [usage, setUsage] = useState<Awaited<ReturnType<typeof mediaUsage>> | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (mode === "page") mediaUsage(item.id).then(setUsage).catch(() => {});
  }, [item.id, mode]);

  function saveAlt() {
    if (alt === item.alt) return;
    start(async () => {
      const res = await updateMediaAlt(item.id, alt);
      setMsg(res.ok ? { ok: true, text: "Alt text saved." } : { ok: false, text: res.error });
      if (res.ok) onChanged({ alt: alt.trim() });
    });
  }

  function remove(force: boolean) {
    start(async () => {
      const res = await deleteMedia(item.id, force);
      if (res.ok) onDeleted();
      else if (res.inUse) setConfirm(res.error);
      else setMsg({ ok: false, text: res.error });
    });
  }

  const absoluteUrl = typeof window !== "undefined" && item.url.startsWith("/") ? window.location.origin + item.url : item.url;
  const uses = usage ? usage.posts.length + usage.pages.length + usage.profiles.length : 0;

  return (
    <aside className="flex flex-col gap-4 self-start rounded-md border border-line p-4 lg:sticky lg:top-[89px]" aria-label="Image details">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 break-words text-sm font-semibold">{item.filename || "Image"}</h3>
        <button type="button" aria-label="Close details" onClick={onClose} className="cursor-pointer text-muted hover:text-fg">
          <X size={18} />
        </button>
      </div>
      <img src={item.url} alt={item.alt} className="max-h-56 w-full rounded-sm bg-surface object-contain" />
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted">Uploaded</dt>
        <dd>{formatDate(item.createdAt, { year: true })} by {item.uploaderName}</dd>
        <dt className="text-muted">Size</dt>
        <dd className="tabular-nums">
          {formatBytes(item.size)}
          {item.width && item.height ? ` · ${item.width} × ${item.height}` : ""}
        </dd>
      </dl>
      <Field label="Alt text" htmlFor={`alt-${item.id}`} hint="Describe the image for people using screen readers.">
        <Input id={`alt-${item.id}`} value={alt} maxLength={250} onChange={(e) => setAlt(e.target.value)} onBlur={saveAlt} />
      </Field>
      {msg ? <FormMessage tone={msg.ok ? "success" : "error"}>{msg.text}</FormMessage> : null}

      {mode === "picker" ? (
        <Button
          variant="accent"
          onClick={() => {
            if (alt !== item.alt) saveAlt();
            onSelect?.({ url: item.url, alt: alt.trim() });
          }}
        >
          Use this image
        </Button>
      ) : (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(absoluteUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {}
            }}
          >
            {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy link"}
          </Button>
          <div className="text-xs">
            <p className="font-medium">Used in</p>
            {!usage ? (
              <p className="text-muted">Checking…</p>
            ) : uses ? (
              <ul className="mt-1 flex flex-col gap-1">
                {usage.posts.map((p) => (
                  <li key={p.id}>
                    <a href={`/editor/${p.id}`} className="text-accent hover:underline">{p.title || "Untitled story"}</a>
                  </li>
                ))}
                {usage.pages.map((p) => (
                  <li key={p.id}>
                    <a href={`/admin/pages/${p.id}`} className="text-accent hover:underline">Page: {p.title}</a>
                  </li>
                ))}
                {usage.profiles.map((p) => (
                  <li key={p.username}>Profile photo of {p.name}</li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">Not used anywhere.</p>
            )}
          </div>
          {confirm ? (
            <div className="flex flex-col gap-2 rounded-md bg-danger-soft p-3 text-xs text-danger">
              <p>{confirm}</p>
              <div className="flex gap-2">
                <Button variant="danger" size="sm" disabled={pending} onClick={() => remove(true)}>Delete anyway</Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirm(null)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <Button variant="danger-outline" size="sm" disabled={pending} onClick={() => remove(false)}>
              <Trash2 size={15} /> {pending ? "Deleting…" : "Delete image"}
            </Button>
          )}
        </>
      )}
    </aside>
  );
}

/** Full-screen picker dialog used by the editors. */
export function MediaPickerDialog({
  open,
  onClose,
  onSelect,
  title = "Choose an image",
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (item: { url: string; alt: string }) => void;
  title?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div data-media-picker="open" className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-fg/40 px-4 py-8" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-5xl rounded-lg bg-bg p-5 shadow-pop sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="cursor-pointer text-muted hover:text-fg">
            <X size={22} />
          </button>
        </div>
        <MediaBrowser
          mode="picker"
          onSelect={(item) => {
            onSelect(item);
            onClose();
          }}
        />
      </div>
    </div>
  );
}
