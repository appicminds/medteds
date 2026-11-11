"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FormMessage } from "@/components/ui/field";
import { moderateComments, type CommentModeration } from "@/lib/actions";
import { formatDate } from "@/lib/utils";

type Row = {
  id: string;
  body: string;
  status: string;
  createdAt: string;
  userName: string;
  username: string | null;
  userImage: string | null;
  postTitle: string;
  postSlug: string;
};

const ACTIONS: Record<string, { value: CommentModeration; label: string }[]> = {
  pending: [
    { value: "approve", label: "Approve" },
    { value: "spam", label: "Spam" },
    { value: "delete", label: "Delete" },
  ],
  approved: [
    { value: "unapprove", label: "Unapprove" },
    { value: "spam", label: "Spam" },
    { value: "delete", label: "Delete" },
  ],
  spam: [
    { value: "approve", label: "Not spam" },
    { value: "delete", label: "Delete" },
  ],
};

export function CommentQueue({ rows, tab, compact }: { rows: Row[]; tab: string; compact?: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const actions = ACTIONS[tab] ?? ACTIONS.pending;

  function run(action: CommentModeration, ids: string[]) {
    setMsg(null);
    start(async () => {
      const res = await moderateComments(ids, action);
      setMsg(res.ok ? { ok: true, text: res.message ?? "Done." } : { ok: false, text: res.error });
      setSelected(new Set());
      router.refresh();
    });
  }

  if (!rows.length) {
    const feedback = msg ? <FormMessage tone={msg.ok ? "success" : "error"}>{msg.text}</FormMessage> : null;
    return compact ? (
      <div className="flex flex-col gap-3">
        {feedback}
        <p className="text-sm text-muted">Nothing waiting.</p>
      </div>
    ) : (
      <div className="flex flex-col gap-3">
        {feedback}
        <EmptyState title={tab === "pending" ? "No responses waiting" : "Nothing here"}>
          {tab === "pending" ? "New responses that need approval will appear here." : undefined}
        </EmptyState>
      </div>
    );
  }

  const all = rows.every((r) => selected.has(r.id));

  return (
    <div className="flex flex-col gap-3">
      {!compact ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className="mr-2 flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={all}
              onChange={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.id)))}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            Select all
          </label>
          {actions.map((a) => (
            <Button key={a.value} variant="outline" size="sm" disabled={pending || !selected.size} onClick={() => run(a.value, [...selected])}>
              {a.label}
              {selected.size ? ` (${selected.size})` : ""}
            </Button>
          ))}
        </div>
      ) : null}
      {msg ? <FormMessage tone={msg.ok ? "success" : "error"}>{msg.text}</FormMessage> : null}
      <ul className="rounded-md border border-line">
        {rows.map((c) => (
          <li key={c.id} className="flex gap-3 border-b border-line px-4 py-4 last:border-0">
            {!compact ? (
              <input
                type="checkbox"
                aria-label={`Select response by ${c.userName}`}
                checked={selected.has(c.id)}
                onChange={() =>
                  setSelected((s) => {
                    const n = new Set(s);
                    if (n.has(c.id)) n.delete(c.id);
                    else n.add(c.id);
                    return n;
                  })
                }
                className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
              />
            ) : null}
            <Avatar name={c.userName} src={c.userImage} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted">
                <Link href={`/@${c.username}`} className="font-medium text-fg hover:underline">{c.userName}</Link> on{" "}
                <Link href={`/p/${c.postSlug}#responses`} className="hover:underline">{c.postTitle}</Link> · {formatDate(c.createdAt)}
              </p>
              <p className="mt-1.5 line-clamp-4 whitespace-pre-line text-sm">{c.body}</p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                {actions.map((a) => (
                  <button
                    key={a.value}
                    type="button"
                    disabled={pending}
                    onClick={() => run(a.value, [c.id])}
                    className={a.value === "delete" || a.value === "spam" ? "cursor-pointer text-muted hover:text-danger" : "cursor-pointer text-accent hover:underline"}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
