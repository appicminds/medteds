"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createPage, deletePage } from "@/lib/site-actions";

export function NewPageButton() {
  const [pending, start] = useTransition();
  return (
    <Button variant="accent" disabled={pending} onClick={() => start(() => createPage())}>
      {pending ? "Creating…" : "Add new page"}
    </Button>
  );
}

export function DeletePageButton({ id, onDeleted }: { id: string; onDeleted?: () => void }) {
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  if (asking) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="text-xs text-danger">Delete page?</span>
        <Button
          size="sm"
          variant="danger"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await deletePage(id);
              onDeleted?.();
            })
          }
        >
          {pending ? "Deleting…" : "Yes"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>No</Button>
      </span>
    );
  }
  return (
    <Button size="sm" variant="ghost" className="hover:text-danger" onClick={() => setAsking(true)}>
      Delete
    </Button>
  );
}
