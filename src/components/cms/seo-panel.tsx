"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect } from "react";
import { CircleAlert, CircleCheck, X } from "lucide-react";
import { Field, Input, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export type SeoValues = {
  slug: string;
  seoTitle: string;
  seoDescription: string;
  noindex: boolean;
  canonicalUrl: string;
};

type Check = { ok: boolean; text: string };

/** Search-friendliness hints. They guide the writer and never block publishing. */
export function seoChecks(v: SeoValues & { title: string; subtitle: string; hasImage: boolean; topicCount: number; hasSlug: boolean }): Check[] {
  const t = (v.seoTitle || v.title).trim().length;
  const d = (v.seoDescription || v.subtitle).trim().length;
  const checks: Check[] = [
    {
      ok: t >= 30 && t <= 70,
      text: t === 0 ? "Add a title." : t < 30 ? `Search title is short (${t} characters). Aim for 30–70.` : t > 70 ? `Search title is long (${t}). Google cuts it off after about 70.` : `Search title length is good (${t}).`,
    },
    {
      ok: d >= 70 && d <= 160,
      text: d === 0 ? "Add a search description or a subtitle." : d < 70 ? `Description is short (${d} characters). Aim for 70–160.` : d > 160 ? `Description is long (${d}). Aim for 70–160.` : `Description length is good (${d}).`,
    },
    { ok: v.hasImage, text: v.hasImage ? "Has a preview image for sharing." : "Add a preview image so shared links stand out." },
    { ok: v.topicCount > 0, text: v.topicCount > 0 ? "Tagged with a topic." : "Add at least one topic." },
  ];
  if (v.hasSlug) {
    const n = v.slug.length;
    checks.push({ ok: n > 0 && n <= 60, text: n <= 60 ? "Web address is short and readable." : `Web address is long (${n} characters). Shorter is easier to share.` });
  }
  if (v.noindex) checks.push({ ok: false, text: "Hidden from search engines. Google won't list this story." });
  return checks;
}

export function SeoPanel({
  open,
  onClose,
  values,
  onChange,
  title,
  subtitle,
  image,
  topicCount,
  hasSlug,
  host,
  siteName,
}: {
  open: boolean;
  onClose: () => void;
  values: SeoValues;
  onChange: (patch: Partial<SeoValues>) => void;
  title: string;
  subtitle: string;
  image: string | null;
  topicCount: number;
  hasSlug: boolean;
  host: string;
  siteName: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const previewTitle = values.seoTitle || title || "Untitled story";
  const previewDesc = values.seoDescription || subtitle || "Your story's first lines will show here.";
  const canonicalBad = !!values.canonicalUrl && !/^https?:\/\/\S+$/i.test(values.canonicalUrl.trim());
  const checks = seoChecks({ ...values, title, subtitle, hasImage: !!image, topicCount, hasSlug });
  const passed = checks.filter((c) => c.ok).length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-fg/40" role="dialog" aria-modal="true" aria-labelledby="seo-title-heading" onClick={onClose}>
      <div className="flex h-full w-full flex-col overflow-y-auto bg-bg shadow-pop sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-bg px-5 py-4">
          <div>
            <h2 id="seo-title-heading" className="text-lg font-bold">SEO and sharing</h2>
            <p className="text-xs text-muted">Changes save automatically.</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="cursor-pointer text-muted hover:text-fg">
            <X size={22} />
          </button>
        </div>

        <div className="flex flex-col gap-7 px-5 py-6">
          <section aria-labelledby="seo-check-heading">
            <h3 id="seo-check-heading" className="mb-2 text-sm font-medium">
              Checklist <span className="font-normal text-muted">({passed} of {checks.length} done)</span>
            </h3>
            <ul className="flex flex-col gap-1.5 text-sm">
              {checks.map((c) => (
                <li key={c.text} className="flex items-start gap-2">
                  {c.ok ? (
                    <CircleCheck size={16} className="mt-0.5 shrink-0 text-success" aria-label="Done" />
                  ) : (
                    <CircleAlert size={16} className="mt-0.5 shrink-0 text-warning" aria-label="To improve" />
                  )}
                  <span className={cn(c.ok ? "text-muted" : "text-fg")}>{c.text}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-4">
            <h3 className="text-sm font-medium">Google search result</h3>
            {hasSlug ? (
              <Field label="Web address" htmlFor="story-slug" hint={`${host}/p/${values.slug || "…"}`}>
                <Input id="story-slug" value={values.slug} maxLength={120} onChange={(e) => onChange({ slug: e.target.value })} />
              </Field>
            ) : (
              <p className="text-xs text-muted">The web address is created from the title when the story is first published. You can change it here after that.</p>
            )}
            <Field label="Search title" htmlFor="seo-title" hint={`${values.seoTitle.length}/70. Leave blank to use the story title.`}>
              <Input id="seo-title" value={values.seoTitle} maxLength={70} onChange={(e) => onChange({ seoTitle: e.target.value })} />
            </Field>
            <Field label="Search description" htmlFor="seo-desc" hint={`${values.seoDescription.length}/160. Leave blank to use the subtitle.`}>
              <Textarea id="seo-desc" value={values.seoDescription} maxLength={160} onChange={(e) => onChange({ seoDescription: e.target.value })} className="min-h-20" />
            </Field>
            <div className="rounded-md border border-line p-3" aria-label="Search result preview">
              <p className="truncate text-xs text-muted">{host} › p › {values.slug || "…"}</p>
              <p className="truncate text-base text-accent">{previewTitle}</p>
              <p className="line-clamp-2 text-xs text-muted">{previewDesc}</p>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-medium">When shared on social media</h3>
            <div className="overflow-hidden rounded-md border border-line" aria-label="Social sharing preview">
              {image ? (
                <img src={image} alt="" className="aspect-[1.91/1] w-full object-cover" />
              ) : (
                <div className="grid aspect-[1.91/1] w-full place-items-center bg-surface px-4 text-center text-xs text-muted">
                  No image. Add a preview image in the Publish window.
                </div>
              )}
              <div className="border-t border-line bg-surface px-3 py-2">
                <p className="truncate text-[11px] uppercase tracking-wide text-muted">{host} · {siteName}</p>
                <p className="truncate text-sm font-semibold">{previewTitle}</p>
                <p className="line-clamp-1 text-xs text-muted">{previewDesc}</p>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-4 border-t border-line pt-6">
            <h3 className="text-sm font-medium">Advanced</h3>
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input type="checkbox" checked={values.noindex} onChange={(e) => onChange({ noindex: e.target.checked })} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
              <span>
                <span className="font-medium">Hide from search engines</span>
                <span className="block text-muted">Readers can still open the story, but Google won&apos;t list it.</span>
              </span>
            </label>
            <Field
              label="Original address (canonical URL)"
              htmlFor="seo-canonical"
              hint={canonicalBad ? undefined : "Only if this story was first published on another site. Search engines credit that address."}
            >
              <Input
                id="seo-canonical"
                type="url"
                placeholder="https://"
                value={values.canonicalUrl}
                maxLength={2000}
                aria-invalid={canonicalBad || undefined}
                onChange={(e) => onChange({ canonicalUrl: e.target.value })}
              />
            </Field>
            {canonicalBad ? <p className="-mt-2 text-xs text-danger">The address must start with http:// or https://.</p> : null}
          </section>
        </div>
      </div>
    </div>
  );
}
