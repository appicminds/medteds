import Link from "next/link";
import { AdminHeader, AdminTable } from "@/components/admin/page-header";
import { StoryAdminActions } from "@/components/admin/admin-actions";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { LinkTabs } from "@/components/ui/tabs";
import { adminListStories } from "@/lib/queries";
import { compactNumber, formatDate } from "@/lib/utils";

export const metadata = { title: "Stories" };

export default async function AdminStories({ searchParams }: PageProps<"/admin/stories">) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" && ["published", "draft", "featured"].includes(sp.status) ? sp.status : "";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const stories = await adminListStories({ status: status || undefined, query: q || undefined });
  const qs = (s: string) => `/admin/stories?${new URLSearchParams({ ...(s ? { status: s } : {}), ...(q ? { q } : {}) })}`;

  return (
    <>
      <AdminHeader title="Stories" description="Publish, unpublish and pick stories for the Editor's picks list.">
        <form action="/admin/stories" className="w-full sm:w-64">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <label htmlFor="story-q" className="sr-only">Search titles</label>
          <Input id="story-q" name="q" defaultValue={q} placeholder="Search titles" type="search" />
        </form>
      </AdminHeader>
      <LinkTabs
        className="mb-6"
        active={status || "all"}
        items={[
          { key: "all", label: "All", href: qs("") },
          { key: "published", label: "Published", href: qs("published") },
          { key: "draft", label: "Drafts", href: qs("draft") },
          { key: "featured", label: "Editor's picks", href: qs("featured") },
        ]}
      />
      {stories.length ? (
        <AdminTable>
          <thead>
            <tr>
              <th>Story</th>
              <th>Status</th>
              <th>Engagement</th>
              <th>Updated</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {stories.map((s) => (
              <tr key={s.id}>
                <td className="max-w-[320px]">
                  <Link href={s.status === "published" ? `/p/${s.slug}` : `/editor/${s.id}`} className="block truncate font-medium hover:underline">
                    {s.title || "Untitled story"}
                  </Link>
                  <Link href={`/@${s.authorUsername}`} className="text-xs text-muted hover:underline">
                    {s.authorName}
                  </Link>
                </td>
                <td>
                  <span className="flex flex-wrap gap-1">
                    <Badge tone={s.status === "published" ? "success" : "neutral"}>{s.status === "published" ? "Published" : "Draft"}</Badge>
                    {s.featured ? <Badge tone="accent">Pick</Badge> : null}
                  </span>
                </td>
                <td className="whitespace-nowrap text-muted tabular-nums">
                  {compactNumber(s.clapCount)} claps · {s.commentCount} resp.
                </td>
                <td className="whitespace-nowrap text-muted">{formatDate(s.updatedAt)}</td>
                <td className="text-right">
                  <StoryAdminActions id={s.id} status={s.status} featured={s.featured} />
                </td>
              </tr>
            ))}
          </tbody>
        </AdminTable>
      ) : (
        <p className="py-10 text-center text-muted">No stories match.</p>
      )}
    </>
  );
}
