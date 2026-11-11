import Link from "next/link";
import { AdminHeader } from "@/components/admin/page-header";
import { CommentQueue } from "@/components/admin/comment-queue";
import { QuickDraft } from "@/components/admin/quick-draft";
import { ViewsChart } from "@/components/admin/views-chart";
import { can } from "@/lib/permissions";
import { adminCommentCounts, adminListComments, adminStats, openReportCount, pendingReview, seoAttentionCount, topPosts, viewsByDay } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { requireCan } from "@/lib/session";
import { compactNumber, formatDate } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

function Card({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`flex min-w-0 flex-col gap-4 rounded-md border border-line p-5 ${className ?? ""}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default async function AdminDashboard() {
  const me = await requireCan("viewAdmin", "/admin");
  const settings = await getSettings();
  const [stats, views, top, review, commentCounts, pendingComments, seoTodo, openReports] = await Promise.all([
    adminStats(),
    viewsByDay(30),
    topPosts(30, 5),
    pendingReview(6),
    adminCommentCounts(),
    adminListComments("pending", 5),
    can(me, "manageSeo") ? seoAttentionCount(settings.defaultShareImage) : Promise.resolve(0),
    openReportCount(),
  ]);
  const total30 = views.reduce((n, d) => n + d.n, 0);
  const prev7 = views.slice(-14, -7).reduce((n, d) => n + d.n, 0);
  const last7 = views.slice(-7).reduce((n, d) => n + d.n, 0);
  const change = prev7 ? Math.round(((last7 - prev7) / prev7) * 100) : null;

  const glance = [
    { label: "Views, last 30 days", value: total30 },
    { label: "Live stories", value: stats.stories, href: "/admin/stories?status=published" },
    { label: "Waiting for review", value: stats.pending, href: "/admin/stories?status=pending", attention: stats.pending > 0 },
    { label: "Responses to approve", value: commentCounts.pending, href: "/admin/comments", attention: commentCounts.pending > 0 },
    { label: "Reports to review", value: openReports, href: "/admin/reports", attention: openReports > 0 },
    { label: "Stories to improve for SEO", value: seoTodo, href: "/admin/seo?filter=attention", attention: seoTodo > 0 },
    { label: "Users", value: stats.users, href: can(me, "manageUsers") ? "/admin/users" : undefined },
  ];

  return (
    <>
      <AdminHeader title="Dashboard" description={`Welcome back, ${me.name.split(" ")[0]}.`} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {glance.map((t) => {
          const inner = (
            <>
              <p className="text-xs text-muted">{t.label}</p>
              <p className="mt-1 flex items-center gap-2 text-3xl font-bold tabular-nums">
                {compactNumber(t.value)}
                {t.attention ? <span className="h-2 w-2 rounded-full bg-warning" aria-label="Needs attention" /> : null}
              </p>
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

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card
          title="Views per day"
          action={
            change !== null ? (
              <span className="text-xs text-muted">
                Last 7 days: <span className="font-medium text-fg tabular-nums">{last7.toLocaleString()}</span> ({change >= 0 ? "+" : ""}
                {change}% vs the week before)
              </span>
            ) : null
          }
        >
          {total30 ? (
            <ViewsChart data={views} />
          ) : (
            <p className="py-10 text-center text-sm text-muted">No views yet. They&apos;re counted when readers open a story.</p>
          )}
        </Card>

        <Card title="Top stories, last 30 days">
          {top.length ? (
            <ol className="flex flex-col gap-3">
              {top.map((p, i) => (
                <li key={p.id} className="flex items-baseline gap-3 text-sm">
                  <span className="w-4 text-muted tabular-nums">{i + 1}</span>
                  <Link href={`/p/${p.slug}`} className="min-w-0 flex-1 truncate font-medium hover:underline">{p.title}</Link>
                  <span className="text-muted tabular-nums">{compactNumber(p.n)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted">Nothing yet.</p>
          )}
        </Card>

        <Card title="Waiting for review" action={<Link href="/admin/stories?status=pending" className="text-xs text-accent hover:underline">All pending</Link>}>
          {review.length ? (
            <ul className="flex flex-col gap-3">
              {review.map((p) => (
                <li key={p.id} className="text-sm">
                  <Link href={`/editor/${p.id}`} className="font-medium hover:underline">{p.title || "Untitled story"}</Link>
                  <p className="text-xs text-muted">{p.authorName} · {formatDate(p.updatedAt)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No stories waiting.</p>
          )}
        </Card>

        <Card title="Quick draft">
          <QuickDraft />
        </Card>

        {can(me, "moderateComments") ? (
          <Card title="Responses to approve" className="xl:col-span-2" action={<Link href="/admin/comments" className="text-xs text-accent hover:underline">All responses</Link>}>
            <CommentQueue compact tab="pending" rows={pendingComments.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))} />
          </Card>
        ) : null}
      </div>
    </>
  );
}
