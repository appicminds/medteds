import { AdminHeader } from "@/components/admin/page-header";
import { CommentQueue } from "@/components/admin/comment-queue";
import { LinkTabs } from "@/components/ui/tabs";
import { adminCommentCounts, adminListComments, COMMENT_TABS, type CommentTab } from "@/lib/queries";
import { requireCan } from "@/lib/session";

export const metadata = { title: "Comments" };

const LABELS: Record<CommentTab, string> = { pending: "Pending", approved: "Approved", spam: "Spam" };

export default async function AdminComments({ searchParams }: PageProps<"/admin/comments">) {
  await requireCan("moderateComments", "/admin");
  const raw = (await searchParams).status;
  const tab: CommentTab = (COMMENT_TABS as readonly string[]).includes(raw as string) ? (raw as CommentTab) : "pending";
  const [counts, list] = await Promise.all([adminCommentCounts(), adminListComments(tab)]);
  return (
    <>
      <AdminHeader title="Comments" description="Responses readers leave on stories. Choose when they need approval in Settings." />
      <LinkTabs
        className="mb-6"
        active={tab}
        items={COMMENT_TABS.map((t) => ({ key: t, label: `${LABELS[t]} (${counts[t]})`, href: t === "pending" ? "/admin/comments" : `/admin/comments?status=${t}` }))}
      />
      <CommentQueue
        key={tab}
        tab={tab}
        rows={list.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))}
      />
    </>
  );
}
