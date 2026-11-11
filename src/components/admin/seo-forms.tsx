"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AdminTable } from "@/components/admin/page-header";
import { MediaPickerDialog } from "@/components/cms/media-browser";
import { uploadImage } from "@/components/cms/upload";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/field";
import { saveSiteSeo, saveTopicSeo, type SiteSeoInput } from "@/lib/seo-actions";

type TopicRow = { id: number; name: string; slug: string; seoTitle: string; seoDescription: string; autoTitle: string; autoDescription: string };

/** One row per topic: edit its search title and description in place. */
export function TopicSeoTable({ topics }: { topics: TopicRow[] }) {
  if (!topics.length) return <p className="py-10 text-center text-muted">No topics yet. Add them in Admin → Topics.</p>;
  return (
    <AdminTable>
      <thead>
        <tr>
          <th>Topic</th>
          <th>Search title</th>
          <th>Search description</th>
          <th className="w-24" />
        </tr>
      </thead>
      <tbody>
        {topics.map((t) => (
          <TopicSeoRow key={t.id} topic={t} />
        ))}
      </tbody>
    </AdminTable>
  );
}

function TopicSeoRow({ topic }: { topic: TopicRow }) {
  const router = useRouter();
  const [title, setTitle] = useState(topic.seoTitle);
  const [desc, setDesc] = useState(topic.seoDescription);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const dirty = title !== topic.seoTitle || desc !== topic.seoDescription;
  return (
    <tr>
      <td className="align-top">
        <a href={`/tag/${topic.slug}`} target="_blank" className="font-medium hover:underline">{topic.name}</a>
        <span className="block text-xs text-muted">/tag/{topic.slug}</span>
      </td>
      <td className="align-top">
        <label htmlFor={`topic-seo-title-${topic.id}`} className="sr-only">Search title for {topic.name}</label>
        <Input id={`topic-seo-title-${topic.id}`} value={title} maxLength={70} placeholder={topic.autoTitle} onChange={(e) => setTitle(e.target.value)} />
      </td>
      <td className="align-top">
        <label htmlFor={`topic-seo-desc-${topic.id}`} className="sr-only">Search description for {topic.name}</label>
        <Textarea id={`topic-seo-desc-${topic.id}`} value={desc} maxLength={160} placeholder={topic.autoDescription} onChange={(e) => setDesc(e.target.value)} className="min-h-16" />
        {msg ? <p className={msg.ok ? "mt-1 text-xs text-success" : "mt-1 text-xs text-danger"}>{msg.text}</p> : null}
      </td>
      <td className="align-top">
        <Button
          variant="outline"
          size="sm"
          disabled={!dirty || pending}
          onClick={() =>
            start(async () => {
              const res = await saveTopicSeo(topic.id, { seoTitle: title, seoDescription: desc });
              setMsg(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: res.error });
              if (res.ok) router.refresh();
            })
          }
        >
          {pending ? "Saving…" : "Save"}
        </Button>
      </td>
    </tr>
  );
}

type SiteForm = Required<SiteSeoInput>;

/** Site-wide SEO: home page listing, title separator, sharing defaults and search engine access. */
export function SiteSeoForm({ initial, auto, siteName }: { initial: SiteForm; auto: { title: string; description: string }; siteName: string }) {
  const router = useRouter();
  const [f, setF] = useState<SiteForm>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [picker, setPicker] = useState(false);
  const [pending, start] = useTransition();
  const set = (patch: Partial<SiteForm>) => setF((x) => ({ ...x, ...patch }));

  return (
    <form
      className="flex max-w-2xl flex-col gap-8"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        start(async () => {
          const res = await saveSiteSeo(f);
          setMsg(res.ok ? { ok: true, text: res.message } : { ok: false, text: res.error });
          if (res.ok) router.refresh();
        });
      }}
    >
      <section className="flex flex-col gap-4 border-b border-line pb-8">
        <h2 className="text-lg font-semibold">Home page in search results</h2>
        <Field label="Search title" htmlFor="home-seo-title" hint="Leave blank to use your site name and tagline.">
          <Input id="home-seo-title" value={f.homeSeoTitle} maxLength={70} placeholder={auto.title} onChange={(e) => set({ homeSeoTitle: e.target.value })} />
        </Field>
        <Field label="Search description" htmlFor="home-seo-desc" hint="Leave blank to use your tagline.">
          <Textarea id="home-seo-desc" value={f.homeSeoDescription} maxLength={160} placeholder={auto.description} onChange={(e) => set({ homeSeoDescription: e.target.value })} className="min-h-16" />
        </Field>
        <Field label="Title separator" htmlFor="title-sep" hint={`Page titles look like “Story title ${f.titleSeparator} ${siteName}”.`}>
          <Select id="title-sep" value={f.titleSeparator} onChange={(e) => set({ titleSeparator: e.target.value as SiteForm["titleSeparator"] })} className="w-auto min-w-24">
            {["·", "|", "–", "-", "—", ":"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </Field>
      </section>

      <section className="flex flex-col gap-4 border-b border-line pb-8">
        <h2 className="text-lg font-semibold">Sharing</h2>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Default sharing image</span>
          <div className="flex flex-wrap items-center gap-4">
            <div className="grid h-[84px] w-40 place-items-center overflow-hidden rounded-md border border-line bg-surface">
              {f.defaultShareImage ? <img src={f.defaultShareImage} alt="" className="h-full w-full object-cover" /> : <span className="px-2 text-center text-xs text-muted">No image</span>}
            </div>
            <div className="flex flex-col items-start gap-1 text-sm">
              <label className="cursor-pointer text-accent hover:underline">
                Upload image
                <input
                  type="file"
                  accept="image/png,image/webp,image/jpeg"
                  className="sr-only"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const res = await uploadImage(file);
                    if ("error" in res) setMsg({ ok: false, text: res.error });
                    else set({ defaultShareImage: res.url });
                  }}
                />
              </label>
              <button type="button" className="cursor-pointer text-accent hover:underline" onClick={() => setPicker(true)}>Choose from library</button>
              {f.defaultShareImage ? (
                <button type="button" className="cursor-pointer text-muted hover:text-fg" onClick={() => set({ defaultShareImage: "" })}>Remove</button>
              ) : null}
            </div>
          </div>
          <p className="text-xs text-muted">Used when a story or page has no image of its own. 1200 × 630 pixels works best.</p>
        </div>
        <Field label="X (Twitter) handle" htmlFor="seo-twitter" hint="Credited on sharing cards.">
          <Input id="seo-twitter" value={f.twitterHandle} maxLength={16} placeholder="@yourname" onChange={(e) => set({ twitterHandle: e.target.value })} />
        </Field>
      </section>

      <section className="flex flex-col gap-4 border-b border-line pb-8">
        <h2 className="text-lg font-semibold">Search engines</h2>
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input type="checkbox" checked={f.searchVisible} onChange={(e) => set({ searchVisible: e.target.checked })} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
          <span>
            <span className="font-medium">Let search engines show this site</span>
            <span className="block text-muted">Turn this off while you&apos;re setting up. Google and others are asked not to list any page until you turn it back on.</span>
          </span>
        </label>
        <Field label="Google Search Console code" htmlFor="seo-google" hint="In Search Console, choose “HTML tag” verification and paste the code or the whole tag here.">
          <Input id="seo-google" value={f.googleVerification} maxLength={200} onChange={(e) => set({ googleVerification: e.target.value })} />
        </Field>
        <ul className="flex flex-col gap-1 text-sm">
          <li><a href="/sitemap.xml" target="_blank" className="text-accent hover:underline">/sitemap.xml</a> <span className="text-muted">— submit this in Search Console</span></li>
          <li><a href="/robots.txt" target="_blank" className="text-accent hover:underline">/robots.txt</a></li>
          <li><a href="/feed.xml" target="_blank" className="text-accent hover:underline">/feed.xml</a> <span className="text-muted">— RSS feed</span></li>
        </ul>
      </section>

      {msg ? <FormMessage tone={msg.ok ? "success" : "error"}>{msg.text}</FormMessage> : null}
      <div>
        <Button type="submit" variant="solid" disabled={pending}>
          {pending ? "Saving…" : "Save site SEO"}
        </Button>
      </div>
      <MediaPickerDialog open={picker} onClose={() => setPicker(false)} title="Choose a sharing image" onSelect={(item) => set({ defaultShareImage: item.url })} />
    </form>
  );
}
