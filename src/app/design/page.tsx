import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Cover } from "@/components/ui/cover";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/field";
import { LinkTabs } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/blog/theme-toggle";
import { StoryCard } from "@/components/blog/story-card";
import type { StoryCardData } from "@/lib/queries";

export const metadata = { title: "Design system" };

const colors = [
  ["bg", "Page background"],
  ["surface", "Chips, inputs, panels"],
  ["surface-2", "Hover on surface"],
  ["fg", "Main text"],
  ["muted", "Secondary text"],
  ["line", "Dividers and borders"],
  ["accent", "Brand, links, primary action"],
  ["accent-soft", "Accent backgrounds"],
  ["success", "Published, saved"],
  ["warning", "Drafts, cautions"],
  ["danger", "Delete, errors"],
] as const;

const sample: StoryCardData = {
  id: "design-sample",
  slug: "#",
  title: "What 10,000 ECGs Taught Me About Listening",
  subtitle: "The most important diagnostic tool in the clinic isn't the machine.",
  excerpt: null,
  coverImage: null,
  readingMinutes: 8,
  publishedAt: new Date("2026-11-04"),
  featured: true,
  clapCount: 2400,
  commentCount: 86,
  author: { id: "x", name: "Dr. Amara Reyes", username: "amara", image: null },
  topics: [{ slug: "cardiology", name: "Cardiology" }],
};

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-10">
      <h2 className="text-2xl font-bold">{title}</h2>
      {note ? <p className="mt-1 text-sm text-muted">{note}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default function DesignPage() {
  return (
    <main className="mx-auto max-w-[960px] px-4 pb-24 pt-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-10">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-muted">MedTeds</p>
          <h1 className="text-4xl font-bold tracking-tight">Design system</h1>
          <p className="mt-2 max-w-xl text-muted">
            Tokens live in <code className="font-mono text-sm">src/app/globals.css</code>. Components live in{" "}
            <code className="font-mono text-sm">src/components/ui</code> and <code className="font-mono text-sm">src/components/blog</code>.
          </p>
        </div>
        <ThemeToggle />
      </div>

      <Section title="Colour" note="Use the token name as a Tailwind class, e.g. bg-surface, text-muted, border-line.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {colors.map(([token, use]) => (
            <div key={token} className="overflow-hidden rounded-md border border-line">
              <div className="h-16" style={{ background: `var(--${token})` }} />
              <div className="p-3">
                <p className="font-mono text-xs">{token}</p>
                <p className="text-xs text-muted">{use}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography" note="Inter for the interface, Source Serif 4 for reading.">
        <div className="flex flex-col gap-4">
          <p className="text-4xl font-bold tracking-tight">text-4xl · Story title</p>
          <p className="text-3xl font-bold tracking-tight">text-3xl · Page title</p>
          <p className="text-2xl font-bold">text-2xl · Card title</p>
          <p className="text-xl font-semibold">text-xl · Section heading</p>
          <p className="text-base">text-base · Interface text</p>
          <p className="text-sm text-muted">text-sm · Secondary text</p>
          <p className="text-xs text-muted">text-xs · Meta and captions</p>
          <div className="prose-story mt-4 max-w-reading">
            <p>
              .prose-story · Long-form reading text is set in the serif at 20px with generous line height, so a
              ten-minute story stays comfortable on any screen.
            </p>
            <blockquote>A quote inside a story.</blockquote>
          </div>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Solid</Button>
          <Button variant="accent">Accent</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="subtle">Subtle</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="danger-outline">Danger outline</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
      </Section>

      <Section title="Chips, badges and tabs">
        <div className="flex flex-wrap gap-2">
          <Chip href="#">Cardiology</Chip>
          <Chip href="#">Mental Health</Chip>
          <Chip active>Selected</Chip>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Badge>Draft</Badge>
          <Badge tone="success">Published</Badge>
          <Badge tone="accent">Editor&apos;s pick</Badge>
          <Badge tone="warning">Needs review</Badge>
          <Badge tone="danger">Suspended</Badge>
        </div>
        <LinkTabs
          className="mt-8"
          active="a"
          items={[
            { key: "a", label: "For you", href: "#" },
            { key: "b", label: "Following", href: "#" },
            { key: "c", label: "Cardiology", href: "#" },
          ]}
        />
      </Section>

      <Section title="Avatars and covers" note="Without a photo, avatars and covers get a colour pattern generated from the name or story.">
        <div className="flex flex-wrap items-end gap-4">
          <Avatar name="Amara Reyes" size="xs" />
          <Avatar name="Amara Reyes" size="sm" />
          <Avatar name="Jonah Kim" size="md" />
          <Avatar name="Priya Nair" size="lg" />
          <Avatar name="Lena Weiss" size="xl" />
          <Cover seed="cover-a" className="h-24 w-36 rounded-sm" />
          <Cover seed="cover-b" className="h-24 w-36 rounded-sm" />
        </div>
      </Section>

      <Section title="Form controls">
        <div className="grid max-w-md gap-4">
          <Field label="Name" htmlFor="ds-name" hint="Shown on your profile.">
            <Input id="ds-name" placeholder="Dr. Amara Reyes" />
          </Field>
          <Field label="Specialty" htmlFor="ds-select">
            <Select id="ds-select" defaultValue="cardio">
              <option value="cardio">Cardiology</option>
              <option value="neuro">Neurology</option>
            </Select>
          </Field>
          <Field label="Bio" htmlFor="ds-bio">
            <Textarea id="ds-bio" placeholder="A sentence about you" />
          </Field>
          <FormMessage tone="success">Profile saved.</FormMessage>
          <FormMessage tone="error">Usernames need at least 3 characters.</FormMessage>
        </div>
      </Section>

      <Section title="Story card">
        <div className="max-w-feed border-t border-line">
          <StoryCard story={sample} saved={false} signedIn={false} />
        </div>
      </Section>

      <Section title="Empty state">
        <EmptyState title="Nothing saved yet" action={<Button variant="outline">Browse stories</Button>}>
          Tap the bookmark icon on any story to save it here for later.
        </EmptyState>
      </Section>
    </main>
  );
}
