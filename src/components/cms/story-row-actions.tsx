"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteStoryForever, restoreStory, trashStory, unpublishStory } from "@/lib/post-actions";

export function StoryRowActions({ id, status, canPublish }: { id: string; status: string; canPublish: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();

  if (status === "trash") {
    if (confirm) {
      return (
        <span className="flex items-center gap-2">
          <span className="text-danger">Delete for good?</span>
          <Button variant="danger" size="sm" disabled={pending} onClick={() => start(() => deleteStoryForever(id))}>
            {pending ? "Deleting…" : "Delete"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>Cancel</Button>
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1">
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(() => restoreStory(id))}>Restore</Button>
        <Button variant="ghost" size="sm" className="hover:text-danger" onClick={() => setConfirm(true)}>Delete permanently</Button>
      </span>
    );
  }

  // Contributors can't edit a story once it's live.
  const editable = canPublish || (status !== "published" && status !== "scheduled");
  return (
    <span className="flex items-center gap-1">
      {editable ? (
        <Link href={`/editor/${id}`} className="rounded-pill px-3 py-1.5 hover:bg-surface hover:text-fg">Edit</Link>
      ) : null}
      {status === "published" || status === "scheduled" || status === "pending" ? (
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(() => unpublishStory(id))}>
          {status === "pending" ? "Withdraw" : status === "scheduled" ? "Unschedule" : "Unpublish"}
        </Button>
      ) : null}
      {editable ? (
        <Button variant="ghost" size="sm" disabled={pending} className="hover:text-danger" onClick={() => start(() => trashStory(id))}>
          Trash
        </Button>
      ) : null}
    </span>
  );
}
