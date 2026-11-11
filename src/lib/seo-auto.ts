/**
 * Automatic SEO. Every story, page and topic gets a search title, description and sharing image
 * worked out from its own content. An SEO editor can override any of them; a blank override means
 * "automatic". Pure functions, safe on the server and in the browser.
 */

/** Cuts text at a word boundary so it fits in `max` characters, ending cleanly. */
export function clip(text: string | null | undefined, max: number, ellipsis = true) {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  // Prefer ending at a sentence, then at a word.
  const sentence = cut.match(/^(.*[.!?])\s/);
  if (sentence && sentence[1].length >= max * 0.6) return sentence[1];
  return cut.replace(/[\s,;:–—-]+\S*$/, "").replace(/[\s,;:–—-]+$/, "") + (ellipsis ? "…" : "");
}

export const TITLE_MAX = 70;
export const DESCRIPTION_MAX = 155;

export type SeoSource = {
  title: string;
  subtitle?: string | null;
  excerpt?: string | null;
  coverImage?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  shareImage?: string | null;
};

export type EffectiveSeo = {
  title: string;
  description: string;
  image: string | null;
  autoTitle: string;
  autoDescription: string;
  autoImage: string | null;
  customTitle: boolean;
  customDescription: boolean;
  customImage: boolean;
};

/** What search engines and social sites get: the custom value when set, otherwise the automatic one. */
export function effectiveSeo(s: SeoSource, defaultImage: string | null = null): EffectiveSeo {
  // Titles are cut at a word, without "…", which looks odd in browser tabs and search results.
  const autoTitle = clip(s.title, TITLE_MAX, false) || "Untitled story";
  const autoDescription = clip(s.subtitle || s.excerpt, DESCRIPTION_MAX);
  const autoImage = s.coverImage || defaultImage || null;
  const customTitle = !!s.seoTitle?.trim();
  const customDescription = !!s.seoDescription?.trim();
  const customImage = !!s.shareImage;
  return {
    title: customTitle ? s.seoTitle!.trim() : autoTitle,
    description: customDescription ? s.seoDescription!.trim() : autoDescription,
    image: customImage ? s.shareImage! : autoImage,
    autoTitle,
    autoDescription,
    autoImage,
    customTitle,
    customDescription,
    customImage,
  };
}

export type SeoCheck = { ok: boolean; text: string };

/** Search-friendliness hints. They guide the editor and never block publishing. */
export function seoChecks(v: {
  title: string;
  description: string;
  hasImage: boolean;
  topicCount?: number;
  slug?: string | null;
  noindex?: boolean;
}): SeoCheck[] {
  const t = v.title.trim().length;
  const d = v.description.trim().length;
  const checks: SeoCheck[] = [
    {
      ok: t >= 30 && t <= 70,
      text: t === 0 ? "Add a title." : t < 30 ? `Search title is short (${t} characters). Aim for 30–70.` : t > 70 ? `Search title is long (${t}). Google cuts it off after about 70.` : `Search title length is good (${t}).`,
    },
    {
      ok: d >= 70 && d <= 160,
      text: d === 0 ? "Add a search description or a subtitle." : d < 70 ? `Description is short (${d} characters). Aim for 70–160.` : d > 160 ? `Description is long (${d}). Aim for 70–160.` : `Description length is good (${d}).`,
    },
    { ok: v.hasImage, text: v.hasImage ? "Has an image for sharing." : "Add an image so shared links stand out." },
  ];
  if (v.topicCount !== undefined) checks.push({ ok: v.topicCount > 0, text: v.topicCount > 0 ? "Tagged with a topic." : "Add at least one topic." });
  if (v.slug) {
    const n = v.slug.length;
    checks.push({ ok: n <= 60, text: n <= 60 ? "Web address is short and readable." : `Web address is long (${n} characters). Shorter is easier to share.` });
  }
  if (v.noindex) checks.push({ ok: false, text: "Hidden from search engines. Google won't list it." });
  return checks;
}

export function seoScore(checks: SeoCheck[]) {
  return { passed: checks.filter((c) => c.ok).length, total: checks.length };
}
