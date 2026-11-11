"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Lock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { createList, getSaveState, setSaved, type SaveState } from "@/lib/library-actions";
import { cn } from "@/lib/utils";

/** Bookmark icon that opens a menu: save to the reading list or any of the reader's lists, or start a new list. */
export function BookmarkButton({ postId, saved, signedIn, size = 20 }: { postId: string; saved: boolean; signedIn: boolean; size?: number }) {
  const router = useRouter();
  const [on, setOn] = useState(saved);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<SaveState | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [alignLeft, setAlignLeft] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const anySaved = (s: SaveState) => s.readingList || s.lists.some((l) => l.has);

  function openMenu() {
    if (!signedIn) return router.push(`/signin?next=${encodeURIComponent(location.pathname)}`);
    if (open) return setOpen(false);
    const r = wrap.current?.getBoundingClientRect();
    setAlignLeft(!!r && r.right < 280);
    setOpen(true);
    setError(null);
    setCreating(false);
    start(async () => {
      const s = await getSaveState(postId);
      if (!s) return;
      // First click on an unsaved story saves it to the reading list straight away, like Medium.
      if (!anySaved(s)) {
        const res = await setSaved(postId, "reading", true);
        if (res.ok) s.readingList = true;
      }
      setState(s);
      setOn(anySaved(s));
    });
  }

  function toggle(target: string, value: boolean) {
    if (!state) return;
    const next: SaveState =
      target === "reading" ? { ...state, readingList: value } : { ...state, lists: state.lists.map((l) => (l.id === target ? { ...l, has: value } : l)) };
    setState(next);
    setOn(anySaved(next));
    start(async () => {
      const res = await setSaved(postId, target, value);
      if (!res.ok) {
        setError(res.error);
        setState(state);
        setOn(anySaved(state));
      }
      router.refresh();
    });
  }

  function create() {
    start(async () => {
      const res = await createList({ name, isPublic }, postId);
      if (!res.ok) return setError(res.error);
      setState((s) => (s ? { ...s, lists: [...s.lists, { id: res.id, name: name.trim(), isPublic, has: true }] } : s));
      setOn(true);
      setCreating(false);
      setName("");
      router.refresh();
    });
  }

  return (
    <div ref={wrap} className="relative inline-flex">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={on ? "Saved. Change where it's saved" : "Save story"}
        title={on ? "Saved" : "Save"}
        onClick={openMenu}
        className={cn("inline-flex cursor-pointer transition-colors", on ? "text-fg" : "text-muted hover:text-fg")}
      >
        <Bookmark size={size} strokeWidth={1.6} fill={on ? "currentColor" : "none"} />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Save to list"
          className={cn(
            "absolute top-full z-50 mt-2 w-64 rounded-md border border-line bg-bg p-3 text-sm shadow-pop",
            alignLeft ? "left-0" : "right-0",
          )}
        >
          {!state ? (
            <p className="px-1 py-2 text-muted">Loading…</p>
          ) : (
            <>
              <ul className="flex max-h-60 flex-col gap-0.5 overflow-y-auto">
                <li>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-sm px-1 py-1.5 hover:bg-surface">
                    <input type="checkbox" checked={state.readingList} onChange={(e) => toggle("reading", e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
                    <span className="flex-1">Reading list</span>
                    <Lock size={13} className="text-muted" aria-label="Private" />
                  </label>
                </li>
                {state.lists.map((l) => (
                  <li key={l.id}>
                    <label className="flex cursor-pointer items-center gap-2.5 rounded-sm px-1 py-1.5 hover:bg-surface">
                      <input type="checkbox" checked={l.has} onChange={(e) => toggle(l.id, e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
                      <span className="flex-1 truncate">{l.name}</span>
                      {!l.isPublic ? <Lock size={13} className="text-muted" aria-label="Private" /> : null}
                    </label>
                  </li>
                ))}
              </ul>
              <div className="mt-2 border-t border-line pt-2">
                {creating ? (
                  <form
                    className="flex flex-col gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      create();
                    }}
                  >
                    <label htmlFor={`new-list-${postId}`} className="sr-only">List name</label>
                    <Input id={`new-list-${postId}`} autoFocus value={name} maxLength={60} placeholder="Give it a name" onChange={(e) => setName(e.target.value)} className="h-9" />
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
                      <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--accent)]" />
                      Public: shown on your profile
                    </label>
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" variant="solid" disabled={pending || !name.trim()}>
                        Create
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <button type="button" onClick={() => setCreating(true)} className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-1 py-1.5 text-accent hover:bg-surface">
                    <Plus size={16} /> Create new list
                  </button>
                )}
              </div>
              {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
