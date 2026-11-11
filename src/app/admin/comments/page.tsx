import Link from "next/link";
import { AdminHeader } from "@/components/admin/page-header";
import { CommentDeleteButton } from "@/components/admin/admin-actions";
import { EmptyState } from "@/components/ui/empty-state";
import { adminListComments } from "@/lib/queries";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Responses" };

export default async function AdminComments() {
  const list = await adminListComments();
  return (
    <>
      <AdminHeader title="Responses" description="The latest 200 responses across all stories." />
      {list.length ? (
        <ul className="rounded-md border border-line">
          {list.map((c) => (
            <li key={c.id} className="flex flex-col gap-2 border-b border-line px-4 py-4 last:border-0 sm:flex-row sm:items-start sm:gap-6">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted">
                  <Link href={`/@${c.username}`} className="font-medium text-fg hover:underline">{c.userName}</Link> on{" "}
                  <Link href={`/p/${c.postSlug}#responses`} className="hover:underline">{c.postTitle}</Link> · {formatDate(c.createdAt)}
                </p>
                <p className="mt-1.5 line-clamp-3 whitespace-pre-line text-sm">{c.body}</p>
              </div>
              <CommentDeleteButton id={c.id} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No responses yet" />
      )}
    </>
  );
}
