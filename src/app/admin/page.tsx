import Link from "next/link";
import { AdminHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { adminListStories, adminStats } from "@/lib/queries";
import { compactNumber, formatDate } from "@/lib/utils";

export default async function AdminOverview() {
  const [stats, recent] = await Promise.all([adminStats(), adminListStories({})]);
  const tiles = [
    { label: "Published stories", value: stats.stories, href: "/admin/stories?status=published" },
    { label: "Drafts", value: stats.drafts, href: "/admin/stories?status=draft" },
    { label: "Members", value: stats.users, href: "/admin/users" },
    { label: "Responses", value: stats.comments, href: "/admin/comments" },
    { label: "Claps", value: stats.claps },
  ];
  return (
    <>
      <AdminHeader title="Overview" description="What's happening on MedTeds." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {tiles.map((t) => {
          const inner = (
            <>
              <p className="text-xs text-muted">{t.label}</p>
              <p className="mt-1 text-3xl font-bold tabular-nums">{compactNumber(t.value)}</p>
            </>
          );
          return t.href ? (
            <Link key={t.label} href={t.href} className="rounded-md border border-line p-4 transition-colors hover:border-fg">
              {inner}
            </Link>
          ) : (
            <div key={t.label} className="rounded-md border border-line p-4">
              {inner}
            </div>
          );
        })}
      </div>

      <h2 className="mb-4 mt-12 text-lg font-semibold">Recently updated</h2>
      <ul className="rounded-md border border-line">
        {recent.slice(0, 8).map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-0">
            <Badge tone={s.status === "published" ? "success" : "neutral"}>{s.status === "published" ? "Published" : "Draft"}</Badge>
            <Link href={s.status === "published" ? `/p/${s.slug}` : `/editor/${s.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
              {s.title || "Untitled story"}
            </Link>
            <span className="text-xs text-muted">
              {s.authorName} · {formatDate(s.updatedAt)}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
