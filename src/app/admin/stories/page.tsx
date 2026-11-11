import { AdminHeader } from "@/components/admin/page-header";
import { PostsTable } from "@/components/admin/posts-table";
import { ButtonLink } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { LinkTabs } from "@/components/ui/tabs";
import { purgeOldTrash, TRASH_DAYS } from "@/lib/maintenance";
import { ADMIN_POST_TABS, adminListStories, adminPostCounts, listTopics, listWriters, type AdminPostTab } from "@/lib/queries";

export const metadata = { title: "Posts" };

const TAB_LABELS: Record<AdminPostTab, string> = {
  all: "All",
  published: "Published",
  scheduled: "Scheduled",
  pending: "Pending review",
  draft: "Drafts",
  trash: "Trash",
  featured: "Editor's picks",
};

export default async function AdminPosts({ searchParams }: PageProps<"/admin/stories">) {
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const tab = (ADMIN_POST_TABS as readonly string[]).includes(str("status")) ? (str("status") as AdminPostTab) : "all";
  const q = str("q");
  const author = str("author");
  const topic = Number(str("topic")) || undefined;
  const page = Math.max(1, Number(str("page")) || 1);

  if (tab === "trash") await purgeOldTrash();
  const [counts, { rows, hasMore }, writers, topics] = await Promise.all([
    adminPostCounts(),
    adminListStories({ tab, query: q || undefined, authorId: author || undefined, topicId: topic, page }),
    listWriters(),
    listTopics(),
  ]);

  const link = (patch: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged = { status: tab === "all" ? undefined : tab, q, author, topic, page: undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "" && v !== "all") params.set(k, String(v));
    const s = params.toString();
    return `/admin/stories${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <AdminHeader title="Posts" description="Every story on MedTeds, whoever wrote it.">
        <ButtonLink href="/write" variant="accent">
          Add new story
        </ButtonLink>
      </AdminHeader>

      <LinkTabs
        className="mb-5"
        active={tab}
        items={ADMIN_POST_TABS.map((t) => ({ key: t, label: `${TAB_LABELS[t]} (${counts[t]})`, href: link({ status: t, page: undefined }) }))}
      />

      <form action="/admin/stories" className="mb-5 flex flex-wrap items-center gap-2">
        {tab !== "all" ? <input type="hidden" name="status" value={tab} /> : null}
        <label htmlFor="post-author" className="sr-only">Author</label>
        <Select id="post-author" name="author" defaultValue={author} className="w-auto min-w-40">
          <option value="">All authors</option>
          {writers.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </Select>
        <label htmlFor="post-topic" className="sr-only">Topic</label>
        <Select id="post-topic" name="topic" defaultValue={topic ? String(topic) : ""} className="w-auto min-w-40">
          <option value="">All topics</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </Select>
        <label htmlFor="post-q" className="sr-only">Search titles</label>
        <Input id="post-q" name="q" defaultValue={q} placeholder="Search titles" type="search" className="w-full sm:w-56" />
        <button type="submit" className="h-10 cursor-pointer rounded-md border border-line px-4 text-sm hover:bg-surface">
          Filter
        </button>
      </form>

      {tab === "trash" ? (
        <p className="mb-4 text-sm text-muted">Stories in the trash are deleted for good after {TRASH_DAYS} days.</p>
      ) : null}

      <PostsTable
        key={`${tab}-${page}-${q}-${author}-${topic}`}
        tab={tab}
        rows={rows.map((r) => ({ ...r, publishedAt: r.publishedAt?.toISOString() ?? null, updatedAt: r.updatedAt.toISOString() }))}
      />

      {page > 1 || hasMore ? (
        <nav className="mt-6 flex justify-between" aria-label="Pagination">
          {page > 1 ? <ButtonLink href={link({ page: page - 1 })} variant="outline" size="sm">← Previous</ButtonLink> : <span />}
          {hasMore ? <ButtonLink href={link({ page: page + 1 })} variant="outline" size="sm">Next →</ButtonLink> : null}
        </nav>
      ) : null}
    </>
  );
}
