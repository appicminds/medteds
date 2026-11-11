"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteStory, unpublishStory } from "@/lib/actions";

export function StoryRowActions({ id, published }: { id: string; published: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  if (confirm) {
    return (
      <span className="flex items-center gap-2">
        <span className="text-danger">Delete for good?</span>
        <Button variant="danger" size="sm" disabled={pending} onClick={() => start(() => deleteStory(id))}>
          {pending ? "Deleting…" : "Delete"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
          Cancel
        </Button>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <Link href={`/editor/${id}`} className="rounded-pill px-3 py-1.5 hover:bg-surface hover:text-fg">
        Edit
      </Link>
      {published ? (
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(() => unpublishStory(id))}>
          Unpublish
        </Button>
      ) : null}
      <Button variant="ghost" size="sm" className="hover:text-danger" onClick={() => setConfirm(true)}>
        Delete
      </Button>
    </span>
  );
}
