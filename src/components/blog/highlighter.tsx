"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Highlighter as HighlighterIcon, MessageCircle, Trash2 } from "lucide-react";
import { addHighlight, removeHighlight } from "@/lib/library-actions";
import type { StoryHighlight } from "@/lib/queries";

const CONTEXT = 32;

/** Character offsets of a range within `root`'s text. */
function offsetsOf(root: HTMLElement, range: Range) {
  const pre = document.createRange();
  pre.selectNodeContents(root);
  pre.setEnd(range.startContainer, range.startOffset);
  const start = pre.toString().length;
  return { start, end: start + range.toString().length };
}

/** Wraps the text between two offsets in <mark> elements, splitting text nodes as needed. */
function wrap(root: HTMLElement, start: number, end: number, attrs: Record<string, string>) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const targets: { node: Text; from: number; to: number }[] = [];
  let pos = 0;
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    const len = n.data.length;
    const from = Math.max(start, pos);
    const to = Math.min(end, pos + len);
    if (from < to) targets.push({ node: n, from: from - pos, to: to - pos });
    pos += len;
    if (pos >= end) break;
  }
  for (const { node, from, to } of targets) {
    let part = node;
    if (from > 0) part = part.splitText(from);
    if (to - from < part.data.length) part.splitText(to - from);
    if (!part.data.trim()) continue;
    const mark = document.createElement("mark");
    for (const [k, v] of Object.entries(attrs)) mark.setAttribute(k, v);
    part.parentNode?.insertBefore(mark, part);
    mark.appendChild(part);
  }
}

function unwrap(root: HTMLElement, id: string) {
  root.querySelectorAll(`mark[data-hl-id="${CSS.escape(id)}"]`).forEach((m) => {
    const parent = m.parentNode;
    if (!parent) return;
    while (m.firstChild) parent.insertBefore(m.firstChild, m);
    parent.removeChild(m);
    parent.normalize();
  });
}

/** Finds a highlight's position again: first with its surrounding text, then by the text alone. */
function locate(full: string, h: Pick<StoryHighlight, "text" | "prefix" | "suffix">) {
  const withContext = full.indexOf(h.prefix + h.text + h.suffix);
  if (withContext >= 0) return withContext + h.prefix.length;
  return full.indexOf(h.text);
}

type Toolbar = { x: number; y: number; below: boolean; text: string; prefix: string; suffix: string; removeId?: string };

/** The story body, with highlight, respond and copy actions on selected text. */
export function StoryBody({ html, postId, highlights, signedIn }: { html: string; postId: string; highlights: StoryHighlight[]; signedIn: boolean }) {
  const router = useRouter();
  const root = useRef<HTMLElement>(null);
  const [bar, setBar] = useState<Toolbar | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const shownAt = useRef(0);

  // Paint saved highlights once the story HTML is in place.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    for (const h of highlights) {
      const full = el.textContent ?? "";
      const at = locate(full, h);
      if (at < 0) continue;
      const cls = [h.mine ? "hl" : "", h.top ? "hl-top" : ""].filter(Boolean).join(" ");
      wrap(el, at, at + h.text.length, {
        class: cls,
        "data-hl-id": h.id,
        ...(h.mine ? { "data-hl-mine": "1" } : {}),
        ...(h.top ? { title: `Top highlight · ${h.count} readers` } : {}),
      });
    }
  }, [highlights]);

  const place = useCallback((rect: DOMRect) => {
    shownAt.current = window.scrollY;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const x = Math.min(Math.max(rect.left + rect.width / 2, 110), window.innerWidth - 110);
    const below = coarse || rect.top < 70;
    return { x, y: below ? rect.bottom + 10 : rect.top - 10, below };
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const onSelect = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      if (!el.contains(range.commonAncestorContainer)) return;
      const text = range.toString();
      if (text.trim().length < 3) return;
      const { start, end } = offsetsOf(el, range);
      const full = el.textContent ?? "";
      setCopied(false);
      setBar({ ...place(range.getBoundingClientRect()), text, prefix: full.slice(Math.max(0, start - CONTEXT), start), suffix: full.slice(end, end + CONTEXT) });
    };
    const onClick = (e: MouseEvent) => {
      const mark = (e.target as HTMLElement).closest<HTMLElement>("mark[data-hl-mine]");
      if (!mark || !window.getSelection()?.isCollapsed) return;
      const id = mark.dataset.hlId!;
      const marks = el.querySelectorAll(`mark[data-hl-id="${CSS.escape(id)}"]`);
      const text = Array.from(marks).map((m) => m.textContent).join("");
      setCopied(false);
      setBar({ ...place(mark.getBoundingClientRect()), text, prefix: "", suffix: "", removeId: id });
    };
    // Close when the reader scrolls away, but not on the small scrolls that happen while selecting.
    const hide = () => {
      if (Math.abs(window.scrollY - shownAt.current) > 60) setBar(null);
    };
    const onDown = (e: Event) => {
      if (!(e.target as HTMLElement).closest("[data-hl-toolbar]")) setBar(null);
    };
    el.addEventListener("mouseup", onSelect);
    el.addEventListener("keyup", onSelect);
    el.addEventListener("touchend", () => setTimeout(onSelect, 50));
    el.addEventListener("click", onClick);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", hide, { passive: true });
    return () => {
      el.removeEventListener("mouseup", onSelect);
      el.removeEventListener("keyup", onSelect);
      el.removeEventListener("click", onClick);
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", hide);
    };
  }, [place]);

  async function highlight() {
    if (!bar || !root.current) return;
    if (!signedIn) return router.push(`/signin?next=${encodeURIComponent(location.pathname)}`);
    setBusy(true);
    const res = await addHighlight({ postId, text: bar.text, prefix: bar.prefix, suffix: bar.suffix });
    setBusy(false);
    if (!res.ok) return;
    const full = root.current.textContent ?? "";
    const at = locate(full, bar);
    if (at >= 0) wrap(root.current, at, at + bar.text.length, { class: "hl", "data-hl-id": res.id, "data-hl-mine": "1" });
    window.getSelection()?.removeAllRanges();
    setBar(null);
  }

  async function remove() {
    if (!bar?.removeId || !root.current) return;
    setBusy(true);
    await removeHighlight(bar.removeId);
    setBusy(false);
    unwrap(root.current, bar.removeId);
    setBar(null);
  }

  function respond() {
    if (!bar) return;
    const box = document.getElementById("comment-body") as HTMLTextAreaElement | null;
    if (!box) return router.push(`/signin?next=${encodeURIComponent(location.pathname)}`);
    box.value = `“${bar.text.trim()}”\n\n`;
    box.scrollIntoView({ behavior: "smooth", block: "center" });
    box.focus();
    box.setSelectionRange(box.value.length, box.value.length);
    window.getSelection()?.removeAllRanges();
    setBar(null);
  }

  async function copy() {
    if (!bar) return;
    try {
      await navigator.clipboard.writeText(`“${bar.text.trim()}”\n${location.origin}${location.pathname}`);
      setCopied(true);
      setTimeout(() => setBar(null), 900);
    } catch {
      setBar(null);
    }
  }

  const btn = "inline-flex h-9 cursor-pointer items-center gap-1.5 px-3 text-sm text-bg/90 hover:text-bg disabled:opacity-50";

  return (
    <>
      <article ref={root} className="prose-story" dangerouslySetInnerHTML={{ __html: html }} />
      {bar ? (
        <div
          data-hl-toolbar
          role="toolbar"
          aria-label="Selected text"
          className="fixed z-50 flex -translate-x-1/2 items-center divide-x divide-bg/20 overflow-hidden rounded-md bg-fg shadow-pop"
          style={{ left: bar.x, top: bar.y, transform: `translate(-50%, ${bar.below ? "0" : "-100%"})` }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {bar.removeId ? (
            <button type="button" className={btn} disabled={busy} onClick={remove}>
              <Trash2 size={16} /> Remove highlight
            </button>
          ) : (
            <button type="button" className={btn} disabled={busy} onClick={highlight}>
              <HighlighterIcon size={16} /> Highlight
            </button>
          )}
          <button type="button" className={btn} onClick={respond}>
            <MessageCircle size={16} /> Respond
          </button>
          <button type="button" className={btn} onClick={copy} aria-label="Copy quote with link">
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
      ) : null}
    </>
  );
}
