import Link from "next/link";
import { AdminHeader } from "@/components/admin/page-header";
import { ReportActions } from "@/components/admin/report-actions";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkTabs } from "@/components/ui/tabs";
import { can } from "@/lib/permissions";
import { adminListReports } from "@/lib/queries";
import { REPORT_REASON_LABELS, type ReportReason } from "@/lib/report-reasons";
import { requireCan } from "@/lib/session";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Reports" };

export default async function AdminReports({ searchParams }: PageProps<"/admin/reports">) {
  const me = await requireCan("moderateComments", "/admin/reports");
  const status = (await searchParams).status === "closed" ? "closed" : "open";
  const rows = await adminListReports(status);
  return (
    <>
      <AdminHeader title="Reports" description="Stories and responses readers reported. Review each one, then remove it, resolve it or dismiss it." />
      <LinkTabs
        className="mb-6"
        active={status}
        items={[
          { key: "open", label: "Open", href: "/admin/reports" },
          { key: "closed", label: "Closed", href: "/admin/reports?status=closed" },
        ]}
      />
      {rows.length ? (
        <ul className="flex flex-col gap-4">
          {rows.map((r) => (
            <li key={r.id} className="rounded-md border border-line p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge tone="danger">{REPORT_REASON_LABELS[r.reason as ReportReason] ?? r.reason}</Badge>
                <span className="text-muted">
                  {r.post ? "Story" : "Response"} reported by{" "}
                  <Link href={`/@${r.reporterUsername}`} className="text-fg hover:underline">{r.reporterName}</Link> · {formatDate(r.createdAt, { year: true })}
                  {r.others ? ` · ${r.others} more ${r.others === 1 ? "report" : "reports"}` : ""}
                </span>
                {status === "closed" ? <Badge tone="neutral">{r.status === "dismissed" ? "Dismissed" : "Resolved"}</Badge> : null}
              </div>
              {r.post ? (
                <p className="mt-3 font-medium">
                  <Link href={`/p/${r.post.slug}`} className="hover:underline" target="_blank">{r.post.title}</Link>
                  {r.post.status === "trash" ? <span className="ml-2 text-xs text-muted">(in trash)</span> : null}
                </p>
              ) : r.comment ? (
                <blockquote className="mt-3 border-l-2 border-line pl-3 text-sm">
                  <p className="line-clamp-4 whitespace-pre-line">{r.comment.body}</p>
                  <p className="mt-1 text-xs text-muted">
                    by {r.comment.authorName} on <Link href={`/p/${r.comment.postSlug}#responses`} className="hover:underline" target="_blank">the story</Link>
                    {r.comment.status === "spam" ? " · marked as spam" : ""}
                  </p>
                </blockquote>
              ) : null}
              {r.note ? <p className="mt-3 rounded-sm bg-surface px-3 py-2 text-sm">&ldquo;{r.note}&rdquo;</p> : null}
              {status === "open" ? (
                <div className="mt-4">
                  <ReportActions id={r.id} kind={r.post ? "story" : "response"} canRemove={r.post ? can(me, "editOthersPosts") && r.post.status !== "trash" : r.comment?.status !== "spam"} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={status === "open" ? "No open reports" : "No closed reports yet"}>
          {status === "open" ? "When readers report a story or response, it shows up here." : "Resolved and dismissed reports are kept here."}
        </EmptyState>
      )}
    </>
  );
}
