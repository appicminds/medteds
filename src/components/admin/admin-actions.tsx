"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  adminDeleteStory,
  adminDeleteTopic,
  adminSetBanned,
  adminSetFeatured,
  adminSetRole,
  adminSetStatus,
  deleteComment,
} from "@/lib/actions";

/** A small button that runs a server action, with an optional inline "Are you sure?" step. */
function ActionButton({
  label,
  pendingLabel,
  run,
  confirm,
  variant = "ghost",
}: {
  label: string;
  pendingLabel?: string;
  run: () => Promise<unknown>;
  confirm?: string;
  variant?: "ghost" | "outline" | "danger-outline";
}) {
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  if (asking) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="text-xs text-danger">{confirm}</span>
        <Button
          size="sm"
          variant="danger"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await run();
              setAsking(false);
            })
          }
        >
          {pending ? pendingLabel ?? "Working…" : "Yes"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>
          No
        </Button>
      </span>
    );
  }
  return (
    <Button
      size="sm"
      variant={variant}
      disabled={pending}
      onClick={() => (confirm ? setAsking(true) : start(async () => void (await run())))}
    >
      {pending ? pendingLabel ?? "Working…" : label}
    </Button>
  );
}

export function StoryAdminActions({ id, status, featured }: { id: string; status: string; featured: boolean }) {
  return (
    <span className="flex flex-wrap justify-end gap-1">
      {status === "published" ? (
        <>
          <ActionButton label={featured ? "Unpick" : "Pick"} run={() => adminSetFeatured(id, !featured)} />
          <ActionButton label="Unpublish" run={() => adminSetStatus(id, "draft")} />
        </>
      ) : (
        <ActionButton label="Publish" run={() => adminSetStatus(id, "published")} />
      )}
      <ActionButton label="Delete" confirm="Delete story?" pendingLabel="Deleting…" run={() => adminDeleteStory(id)} />
    </span>
  );
}

export function UserAdminActions({ id, role, banned, isMe }: { id: string; role: string; banned: boolean; isMe: boolean }) {
  if (isMe) return <span className="text-xs text-muted">This is you</span>;
  return (
    <span className="flex flex-wrap justify-end gap-1">
      <ActionButton
        label={role === "admin" ? "Remove admin" : "Make admin"}
        confirm={role === "admin" ? undefined : "Give full admin access?"}
        run={() => adminSetRole(id, role === "admin" ? "user" : "admin")}
      />
      <ActionButton
        label={banned ? "Restore" : "Suspend"}
        confirm={banned ? undefined : "Suspend and sign out?"}
        run={() => adminSetBanned(id, !banned)}
      />
    </span>
  );
}

export function TopicDeleteButton({ id }: { id: number }) {
  return <ActionButton label="Delete" confirm="Delete topic?" run={() => adminDeleteTopic(id)} />;
}

export function CommentDeleteButton({ id }: { id: string }) {
  return <ActionButton label="Delete" confirm="Delete response?" run={() => deleteComment(id)} />;
}
