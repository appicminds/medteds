"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { CircleAlert, CircleCheck, X } from "lucide-react";
import { Field, Input, Textarea } from "@/components/ui/field";
import { MediaPickerDialog } from "@/components/cms/media-browser";
import { DESCRIPTION_MAX, seoChecks, TITLE_MAX } from "@/lib/seo-auto";
import { cn } from "@/lib/utils";

export type SeoValues = {
  slug: string;
  seoTitle: string;
  seoDescription: string;
  noindex: boolean;
  canonicalUrl: string;
  shareImage: string;
};

export type SeoAuto = { title: string; description: string; image: string | null };

export type SeoFieldOptions = {
  /** Path before the slug in the address, e.g. "/p/". Omit to hide the address field. */
  slugPrefix?: string;
  /** Why the address can't be edited yet (drafts get theirs on publish). */
  slugNote?: string;
  canonical?: boolean;
  shareImage?: boolean;
  topicCount?: number;
  /** Word used in hints: "story", "page" or "topic". */
  noun?: string;
};

function Tag({ custom, onReset }: { custom: boolean; onReset: () => void }) {
  return custom ? (
    <span className="inline-flex items-center gap-2 text-xs font-normal">
      <span className="rounded-pill bg-accent-soft px-2 py-0.5 text-accent">Custom</span>
      <button type="button" onClick={onReset} className="cursor-pointer text-muted underline-offset-2 hover:text-fg hover:underline">
        Reset to automatic
      </button>
    </span>
  ) : (
    <span className="rounded-pill bg-surface px-2 py-0.5 text-xs font-normal text-muted">Automatic</span>
  );
}

/** Checklist, fields and previews for one story, page or topic. Shared by the editor panel and Admin → SEO. */
export function SeoFields({
  values,
  onChange,
  auto,
  options,
  host,
  siteName,
  idPrefix = "seo",
}: {
  values: SeoValues;
  onChange: (patch: Partial<SeoValues>) => void;
  auto: SeoAuto;
  options: SeoFieldOptions;
  host: string;
  siteName: string;
  idPrefix?: string;
}) {
  const [picker, setPicker] = useState(false);
  const noun = options.noun ?? "story";
  const title = values.seoTitle.trim() || auto.title;
  const description = values.seoDescription.trim() || auto.description;
  const image = (options.shareImage && values.shareImage) || auto.image;
  const path = options.slugPrefix !== undefined ? `${options.slugPrefix}${values.slug || "…"}` : "";
  const canonicalBad = !!values.canonicalUrl && !/^https?:\/\/\S+$/i.test(values.canonicalUrl.trim());
  const checks = seoChecks({
    title,
    description,
    hasImage: !!image,
    topicCount: options.topicCount,
    slug: options.slugPrefix !== undefined && !options.slugNote ? values.slug : null,
    noindex: values.noindex,
  });
  const passed = checks.filter((c) => c.ok).length;
  const id = (s: string) => `${idPrefix}-${s}`;

  return (
    <div className="flex flex-col gap-7">
      <section aria-labelledby={id("check")}>
        <h3 id={id("check")} className="mb-2 text-sm font-medium">
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
        <p className="mt-3 text-xs text-muted">
          Blank fields are filled in automatically from the {noun}. Type in a field to override it.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-medium">Google search result</h3>
        {options.slugPrefix !== undefined ? (
          options.slugNote ? (
            <p className="text-xs text-muted">{options.slugNote}</p>
          ) : (
            <Field label="Web address" htmlFor={id("slug")} hint={`${host}${path}`}>
              <Input id={id("slug")} value={values.slug} maxLength={120} onChange={(e) => onChange({ slug: e.target.value })} />
            </Field>
          )
        ) : null}
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor={id("title")} className="text-sm font-medium">Search title</label>
            <Tag custom={!!values.seoTitle.trim()} onReset={() => onChange({ seoTitle: "" })} />
          </div>
          <Input id={id("title")} value={values.seoTitle} maxLength={70} placeholder={auto.title} onChange={(e) => onChange({ seoTitle: e.target.value })} />
          <p className="text-xs text-muted">{title.length}/70 characters. Automatic: the {noun} title, shortened to {TITLE_MAX}.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor={id("desc")} className="text-sm font-medium">Search description</label>
            <Tag custom={!!values.seoDescription.trim()} onReset={() => onChange({ seoDescription: "" })} />
          </div>
          <Textarea
            id={id("desc")}
            value={values.seoDescription}
            maxLength={160}
            placeholder={auto.description || "Add a subtitle or write a description."}
            onChange={(e) => onChange({ seoDescription: e.target.value })}
            className="min-h-20"
          />
          <p className="text-xs text-muted">{description.length}/160 characters. Automatic: the subtitle or opening lines, shortened to {DESCRIPTION_MAX}.</p>
        </div>
        <div className="rounded-md border border-line p-3" aria-label="Search result preview">
          <p className="truncate text-xs text-muted">{host}{path.replace(/\//g, " › ").replace(/^ › /, " › ")}</p>
          <p className="truncate text-base text-accent">{title || "Untitled"}</p>
          <p className="line-clamp-2 text-xs text-muted">{description || "No description yet."}</p>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium">When shared on social media</h3>
          {options.shareImage ? <Tag custom={!!values.shareImage} onReset={() => onChange({ shareImage: "" })} /> : null}
        </div>
        <div className="overflow-hidden rounded-md border border-line" aria-label="Social sharing preview">
          {image ? (
            <img src={image} alt="" className="aspect-[1.91/1] w-full object-cover" />
          ) : (
            <div className="grid aspect-[1.91/1] w-full place-items-center bg-surface px-4 text-center text-xs text-muted">No image yet.</div>
          )}
          <div className="border-t border-line bg-surface px-3 py-2">
            <p className="truncate text-[11px] uppercase tracking-wide text-muted">{host} · {siteName}</p>
            <p className="truncate text-sm font-semibold">{title || "Untitled"}</p>
            <p className="line-clamp-1 text-xs text-muted">{description}</p>
          </div>
        </div>
        {options.shareImage ? (
          <p className="text-xs text-muted">
            Automatic: the {noun}&apos;s preview image, or the site&apos;s default.{" "}
            <button type="button" className="cursor-pointer text-accent hover:underline" onClick={() => setPicker(true)}>
              Choose a different sharing image
            </button>
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-4 border-t border-line pt-6">
        <h3 className="text-sm font-medium">Advanced</h3>
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input type="checkbox" checked={values.noindex} onChange={(e) => onChange({ noindex: e.target.checked })} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
          <span>
            <span className="font-medium">Hide from search engines</span>
            <span className="block text-muted">Readers can still open it, but Google won&apos;t list it.</span>
          </span>
        </label>
        {options.canonical ? (
          <>
            <Field
              label="Original address (canonical URL)"
              htmlFor={id("canonical")}
              hint={canonicalBad ? undefined : `Only if this ${noun} was first published on another site. Search engines credit that address.`}
            >
              <Input
                id={id("canonical")}
                type="url"
                placeholder="https://"
                value={values.canonicalUrl}
                maxLength={2000}
                aria-invalid={canonicalBad || undefined}
                onChange={(e) => onChange({ canonicalUrl: e.target.value })}
              />
            </Field>
            {canonicalBad ? <p className="-mt-2 text-xs text-danger">The address must start with http:// or https://.</p> : null}
          </>
        ) : null}
      </section>

      {options.shareImage ? (
        <MediaPickerDialog open={picker} onClose={() => setPicker(false)} title="Choose a sharing image" onSelect={(item) => onChange({ shareImage: item.url })} />
      ) : null}
    </div>
  );
}

/** A right-hand drawer (full screen on phones). */
export function SeoDrawer({
  open,
  onClose,
  heading,
  subheading,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  heading: string;
  subheading?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // Let an open media picker handle Escape first.
      if (e.key === "Escape" && !document.querySelector('[data-media-picker="open"]')) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-fg/40" role="dialog" aria-modal="true" aria-label={heading} onClick={onClose}>
      <div className="flex h-full w-full flex-col bg-bg shadow-pop sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold">{heading}</h2>
            {subheading ? <p className="truncate text-xs text-muted">{subheading}</p> : null}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="cursor-pointer text-muted hover:text-fg">
            <X size={22} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-6">{children}</div>
        {footer ? <div className="border-t border-line px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}
