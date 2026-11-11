import type { JSONContent } from "@tiptap/core";

/** Tiptap extensions used to render stored story JSON. Must match the editor. */
export async function renderStoryHtml(doc: JSONContent | null | undefined) {
  if (!doc || !doc.type) return "";
  const [{ generateHTML }, StarterKit, Image] = await Promise.all([
    import("@tiptap/html"),
    import("@tiptap/starter-kit").then((m) => m.default),
    import("@tiptap/extension-image").then((m) => m.default),
  ]);
  return generateHTML(doc, [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      link: { openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" } },
    }),
    Image,
  ]);
}

/** Plain text from a Tiptap document (for excerpts, search and reading time). */
export function storyText(doc: JSONContent | null | undefined): string {
  if (!doc) return "";
  if (doc.type === "text") return doc.text ?? "";
  const inner = (doc.content ?? []).map(storyText).join(doc.type === "doc" ? "\n" : "");
  return ["paragraph", "heading", "blockquote", "listItem", "codeBlock"].includes(doc.type ?? "")
    ? inner + "\n"
    : inner;
}

export function readingMinutes(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 230));
}

export function makeExcerpt(text: string, max = 200) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

/** First image in the story, used as the card thumbnail when no cover is set. */
export function firstImage(doc: JSONContent | null | undefined): string | null {
  if (!doc) return null;
  if (doc.type === "image" && typeof doc.attrs?.src === "string") return doc.attrs.src;
  for (const c of doc.content ?? []) {
    const found = firstImage(c);
    if (found) return found;
  }
  return null;
}

/** Keep only safe links and images in stored story JSON. */
export function sanitizeDoc(node: JSONContent): JSONContent {
  const safeUrl = (u: unknown) =>
    typeof u === "string" && (/^https?:\/\//i.test(u) || /^mailto:/i.test(u) || u.startsWith("/"));
  const out: JSONContent = { ...node };
  if (node.marks) {
    out.marks = node.marks.filter((m) => m.type !== "link" || safeUrl(m.attrs?.href));
  }
  if (node.type === "image" && !safeUrl(node.attrs?.src)) {
    return { type: "paragraph" };
  }
  if (node.content) out.content = node.content.map(sanitizeDoc);
  return out;
}
