import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { ClapButton } from "@/components/blog/clap-button";
import { CommentForm, DeleteCommentButton, ReplyButton } from "@/components/blog/comment-form";
import { MoreMenu } from "@/components/blog/more-menu";
import { getComments, type CommentRow } from "@/lib/queries";
import type { CurrentUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";

export async function Comments({ postId, postAuthorId, me }: { postId: string; postAuthorId: string; me: CurrentUser | null }) {
  const list = await getComments(postId, me?.id);
  // Newest responses first; replies under each, oldest first, like a conversation.
  const top = list.filter((c) => !c.parentId);
  const replies = new Map<string, CommentRow[]>();
  for (const c of [...list].reverse()) {
    if (!c.parentId) continue;
    replies.set(c.parentId, [...(replies.get(c.parentId) ?? []), c]);
  }
  const approved = list.filter((c) => c.status === "approved").length;
  const meLite = me ? { name: me.name, image: me.image } : null;

  const item = (c: CommentRow, isReply: boolean) => (
    <div className="flex flex-wrap items-start gap-x-3">
      <Link href={`/@${c.username}`} className="shrink-0">
        <Avatar name={c.name} src={c.image} size={isReply ? "xs" : "sm"} />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/@${c.username}`} className="text-sm font-medium hover:underline">
          {c.name}
        </Link>
        {c.userId === postAuthorId ? <span className="ml-2 rounded-pill bg-surface px-2 py-0.5 text-[11px] text-muted">Author</span> : null}
        <p className="text-xs text-muted">
          {formatDate(c.createdAt)}
          {c.status === "pending" ? <span className="ml-2 text-warning">Awaiting approval · only you can see this</span> : null}
        </p>
      </div>
      <span className="flex items-center gap-1">
        {me && (me.id === c.userId || me.id === postAuthorId || can(me, "moderateComments")) ? <DeleteCommentButton commentId={c.id} /> : null}
        {me?.id !== c.userId ? (
          <MoreMenu
            target={{ commentId: c.id }}
            label={`More options for ${c.name}'s response`}
            writer={me ? { id: c.userId, name: c.name, muted: false } : null}
            signedIn={!!me}
            size={18}
          />
        ) : null}
      </span>
      <p className="mt-3 basis-full whitespace-pre-line text-[15px] leading-6">{c.body}</p>
      {c.status === "approved" ? (
        <div className="mt-3 flex basis-full flex-wrap items-center gap-5">
          <ClapButton postId={postId} commentId={c.id} total={c.clapCount} mine={c.myClaps} signedIn={!!me} isAuthor={me?.id === c.userId} iconSize={18} />
          {!isReply ? <ReplyButton postId={postId} parentId={c.id} replyTo={c.name} me={meLite} /> : null}
        </div>
      ) : null}
    </div>
  );

  return (
    <section id="responses" className="flex flex-col gap-8 scroll-mt-24">
      <h2 className="text-xl font-bold">Responses ({approved})</h2>
      {meLite ? (
        <CommentForm postId={postId} me={meLite} />
      ) : (
        <p className="rounded-md bg-surface px-4 py-3 text-sm text-muted">
          <Link href={`/signin`} className="font-medium text-accent hover:underline">
            Sign in
          </Link>{" "}
          to share your thoughts.
        </p>
      )}
      <ul className="flex flex-col">
        {top.map((c) => {
          const thread = replies.get(c.id) ?? [];
          return (
            <li key={c.id} className="border-b border-line py-6">
              {item(c, false)}
              {thread.length ? (
                <ul className="mt-5 flex flex-col gap-5 border-l-2 border-line pl-4 sm:ml-11" aria-label={`Replies to ${c.name}`}>
                  {thread.map((r) => (
                    <li key={r.id}>{item(r, true)}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
