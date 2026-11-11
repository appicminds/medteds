"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/field";
import { MediaPickerDialog } from "@/components/cms/media-browser";
import { uploadImage } from "@/components/cms/upload";
import { saveSiteSettings, type SettingsInput } from "@/lib/site-actions";

type Form = Required<Pick<SettingsInput, "siteName" | "tagline" | "logoUrl" | "accentColor" | "signupOpen" | "commentApproval">> & {
  social: { website: string; twitter: string; linkedin: string; instagram: string; youtube: string };
};

const DEFAULT_ACCENT = "#c2410c";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-b border-line pb-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function SettingsForm({ initial }: { initial: Form }) {
  const router = useRouter();
  const [f, setF] = useState<Form>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [picker, setPicker] = useState(false);
  const [pending, start] = useTransition();
  const set = (patch: Partial<Form>) => setF((x) => ({ ...x, ...patch }));

  return (
    <form
      className="flex max-w-2xl flex-col gap-8"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        start(async () => {
          const res = await saveSiteSettings(f);
          setMsg(res.ok ? { ok: true, text: res.message ?? "Saved." } : { ok: false, text: res.error });
          if (res.ok) router.refresh();
        });
      }}
    >
      <Section title="Site identity">
        <Field label="Site name" htmlFor="set-name">
          <Input id="set-name" value={f.siteName} maxLength={40} onChange={(e) => set({ siteName: e.target.value })} required />
        </Field>
        <Field label="Tagline" htmlFor="set-tagline" hint="Shown in search results and browser tabs on the home page.">
          <Input id="set-tagline" value={f.tagline} maxLength={120} onChange={(e) => set({ tagline: e.target.value })} />
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Logo</span>
          <div className="flex flex-wrap items-center gap-4">
            <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-md border border-line bg-surface">
              {f.logoUrl ? <img src={f.logoUrl} alt="" className="h-full w-full object-contain" /> : <span className="h-7 w-7 rounded-[50%_50%_50%_4px] bg-accent" aria-hidden />}
            </div>
            <div className="flex flex-col items-start gap-1 text-sm">
              <label className="cursor-pointer text-accent hover:underline">
                Upload logo
                <input
                  type="file"
                  accept="image/png,image/webp,image/jpeg"
                  className="sr-only"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const res = await uploadImage(file);
                    if ("error" in res) setMsg({ ok: false, text: res.error });
                    else set({ logoUrl: res.url });
                  }}
                />
              </label>
              <button type="button" className="cursor-pointer text-accent hover:underline" onClick={() => setPicker(true)}>Choose from library</button>
              {f.logoUrl ? (
                <button type="button" className="cursor-pointer text-muted hover:text-fg" onClick={() => set({ logoUrl: "" })}>
                  Use the default mark
                </button>
              ) : null}
            </div>
          </div>
          <p className="text-xs text-muted">A square image works best. It appears next to the site name.</p>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="set-accent" className="text-sm font-medium">Brand colour</label>
          <div className="flex items-center gap-3">
            <input
              id="set-accent"
              type="color"
              value={f.accentColor || DEFAULT_ACCENT}
              onChange={(e) => set({ accentColor: e.target.value })}
              className="h-10 w-14 cursor-pointer rounded-md border border-line bg-bg p-1"
            />
            <span className="font-mono text-sm">{f.accentColor || `${DEFAULT_ACCENT} (default)`}</span>
            {f.accentColor ? (
              <button type="button" className="cursor-pointer text-sm text-muted hover:text-fg" onClick={() => set({ accentColor: "" })}>
                Reset
              </button>
            ) : null}
          </div>
          <p className="text-xs text-muted">Used for links, the Publish button and highlights, in light and dark mode.</p>
        </div>
      </Section>

      <Section title="Social links">
        {(
          [
            ["website", "Website"],
            ["twitter", "X (Twitter)"],
            ["linkedin", "LinkedIn"],
            ["instagram", "Instagram"],
            ["youtube", "YouTube"],
          ] as const
        ).map(([key, label]) => (
          <Field key={key} label={label} htmlFor={`set-${key}`}>
            <Input
              id={`set-${key}`}
              type="url"
              placeholder="https://"
              value={f.social[key]}
              onChange={(e) => set({ social: { ...f.social, [key]: e.target.value } })}
            />
          </Field>
        ))}
        <p className="text-xs text-muted">Filled-in links appear in the site footer.</p>
      </Section>

      <Section title="Members">
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input type="checkbox" checked={f.signupOpen} onChange={(e) => set({ signupOpen: e.target.checked })} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
          <span>
            <span className="font-medium">Anyone can create an account</span>
            <span className="block text-muted">New accounts are Subscribers: they can read, clap, respond and save. Turn this off to allow invited people only.</span>
          </span>
        </label>
      </Section>

      <Section title="Responses">
        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="mb-2 font-medium">Before a response appears</legend>
          {(
            [
              ["none", "Publish responses straight away"],
              ["first", "Hold a person's first response for approval, then trust them"],
              ["all", "Hold every response for approval"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex cursor-pointer items-center gap-2">
              <input type="radio" name="commentApproval" checked={f.commentApproval === value} onChange={() => set({ commentApproval: value })} className="accent-[var(--accent)]" />
              {label}
            </label>
          ))}
          <p className="mt-1 text-xs text-muted">Responses from Contributors and above are never held.</p>
        </fieldset>
      </Section>

      {msg ? <FormMessage tone={msg.ok ? "success" : "error"}>{msg.text}</FormMessage> : null}
      <div>
        <Button type="submit" variant="solid" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </div>

      <MediaPickerDialog open={picker} onClose={() => setPicker(false)} title="Choose a logo" onSelect={(item) => set({ logoUrl: item.url })} />
    </form>
  );
}
