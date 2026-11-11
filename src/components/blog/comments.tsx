import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { CommentForm, DeleteCommentButton } from "@/components/blog/comment-form";
import { getComments } from "@/lib/queries";
import type { CurrentUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";

export async function Comments({ postId, postAuthorId, me }: { postId: string; postAuthorId: string; me: CurrentUser | null }) {
  const list = await getComments(postId, me?.id);
  const approved = list.filter((c) => c.status === "approved").length;
  return (
    <section id="responses" className="flex flex-col gap-8 scroll-mt-24">
      <h2 className="text-xl font-bold">Responses ({approved})</h2>
      {me ? (
        <CommentForm postId={postId} me={{ name: me.name, image: me.image }} />
      ) : (
        <p className="rounded-md bg-surface px-4 py-3 text-sm text-muted">
          <Link href={`/signin`} className="font-medium text-accent hover:underline">
            Sign in
          </Link>{" "}
          to share your thoughts.
        </p>
      )}
      <ul className="flex flex-col">
        {list.map((c) => (
          <li key={c.id} className="border-b border-line py-6">
            <div className="flex items-center gap-3">
              <Link href={`/@${c.username}`}>
                <Avatar name={c.name} src={c.image} size="sm" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/@${c.username}`} className="text-sm font-medium hover:underline">
                  {c.name}
                </Link>
                <p className="text-xs text-muted">
                  {formatDate(c.createdAt)}
                  {c.status === "pending" ? <span className="ml-2 text-warning">Awaiting approval · only you can see this</span> : null}
                </p>
              </div>
              {me && (me.id === c.userId || me.id === postAuthorId || can(me, "moderateComments")) ? (
                <DeleteCommentButton commentId={c.id} />
              ) : null}
            </div>
            <p className="mt-3 whitespace-pre-line text-[15px] leading-6">{c.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
