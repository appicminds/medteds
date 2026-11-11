"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FormMessage, Textarea } from "@/components/ui/field";
import { addComment, deleteComment } from "@/lib/actions";

export function CommentForm({ postId, me }: { postId: string; me: { name: string; image: string | null } }) {
  const [state, action, pending] = useActionState(addComment, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="flex flex-col gap-3 rounded-md border border-line p-4 shadow-card">
      <div className="flex items-center gap-3">
        <Avatar name={me.name} src={me.image} size="sm" />
        <span className="text-sm font-medium">{me.name}</span>
      </div>
      <input type="hidden" name="postId" value={postId} />
      <label htmlFor="comment-body" className="sr-only">
        Your response
      </label>
      <Textarea id="comment-body" name="body" placeholder="What are your thoughts?" className="border-0 px-0 focus:ring-0" required />
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      <div className="flex justify-end">
        <Button type="submit" variant="accent" size="sm" disabled={pending}>
          {pending ? "Publishing…" : "Respond"}
        </Button>
      </div>
    </form>
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
