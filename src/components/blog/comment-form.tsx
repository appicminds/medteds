"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FormMessage, Textarea } from "@/components/ui/field";
import { addComment, deleteComment } from "@/lib/actions";

export function CommentForm({
  postId,
  me,
  parentId,
  replyTo,
  onCancel,
}: {
  postId: string;
  me: { name: string; image: string | null };
  /** Set for a reply to a response. */
  parentId?: string;
  replyTo?: string;
  onCancel?: () => void;
}) {
  const [state, action, pending] = useActionState(addComment, null);
  const ref = useRef<HTMLFormElement>(null);
  const id = parentId ? `reply-body-${parentId}` : "comment-body";
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className={parentId ? "flex flex-col gap-3 rounded-md border border-line p-3" : "flex flex-col gap-3 rounded-md border border-line p-4 shadow-card"}>
      {parentId ? null : (
        <div className="flex items-center gap-3">
          <Avatar name={me.name} src={me.image} size="sm" />
          <span className="text-sm font-medium">{me.name}</span>
        </div>
      )}
      <input type="hidden" name="postId" value={postId} />
      {parentId ? <input type="hidden" name="parentId" value={parentId} /> : null}
      <label htmlFor={id} className="sr-only">
        {parentId ? `Reply to ${replyTo ?? "response"}` : "Your response"}
      </label>
      <Textarea
        id={id}
        name="body"
        autoFocus={!!parentId}
        placeholder={parentId ? `Reply to ${replyTo ?? "this response"}…` : "What are your thoughts?"}
        className={parentId ? "min-h-16 border-0 px-0 focus:ring-0" : "border-0 px-0 focus:ring-0"}
        required
      />
      {state ? <FormMessage tone={state.ok ? "success" : "error"}>{state.ok ? state.message : state.error}</FormMessage> : null}
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" variant="accent" size="sm" disabled={pending}>
          {pending ? "Publishing…" : parentId ? "Reply" : "Respond"}
        </Button>
      </div>
    </form>
  );
}

/** "Reply" link that opens an inline reply form under a response. */
export function ReplyButton({ postId, parentId, replyTo, me }: { postId: string; parentId: string; replyTo: string; me: { name: string; image: string | null } | null }) {
  const [open, setOpen] = useState(false);
  if (!me)
    return (
      <Link href="/signin" className="text-sm text-muted hover:text-fg">
        Reply
      </Link>
    );
  return (
    <>
      <button type="button" onClick={() => setOpen((o) => !o)} className="cursor-pointer text-sm text-muted hover:text-fg" aria-expanded={open}>
        Reply
      </button>
      {open ? (
        <div className="basis-full pt-3">
          <CommentForm postId={postId} me={me} parentId={parentId} replyTo={replyTo} onCancel={() => setOpen(false)} />
        </div>
      ) : null}
    </>
  );
}

export function DeleteCommentButton({ commentId }: { commentId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(() => deleteComment(commentId))}>
      {pending ? "Deleting…" : "Delete"}
    </Button>
  );
}
