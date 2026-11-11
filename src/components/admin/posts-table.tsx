"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AdminTable } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormMessage, Select } from "@/components/ui/field";
import { bulkPostAction, type BulkAction } from "@/lib/post-actions";
import type { AdminPostTab } from "@/lib/queries";
import { compactNumber, formatDate } from "@/lib/utils";

type Row = {
  id: string;
  slug: string;
  title: string;
  status: string;
  featured: boolean;
  publishedAt: string | null;
  updatedAt: string;
  clapCount: number;
  commentCount: number;
  viewCount: number;
  authorName: string;
  authorUsername: string | null;
};

const STATUS: Record<string, { label: string; tone: "success" | "neutral" | "warning" | "accent" | "danger" }> = {
  published: { label: "Published", tone: "success" },
  scheduled: { label: "Scheduled", tone: "accent" },
  pending: { label: "Pending review", tone: "warning" },
  draft: { label: "Draft", tone: "neutral" },
  trash: { label: "Trash", tone: "danger" },
};

export function PostsTable({ rows, tab }: { rows: Row[]; tab: AdminPostTab }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [action, setAction] = useState<BulkAction | "">("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  const actions: { value: BulkAction; label: string }[] =
    tab === "trash"
      ? [
          { value: "restore", label: "Restore" },
          { value: "delete", label: "Delete permanently" },
        ]
      : [
          { value: "publish", label: "Publish" },
          { value: "draft", label: "Move to drafts" },
          { value: "feature", label: "Add to Editor's picks" },
          { value: "unfeature", label: "Remove from Editor's picks" },
          { value: "trash", label: "Move to trash" },
        ];

  function run(a: BulkAction, ids: string[]) {
    setResult(null);
    start(async () => {
      const res = await bulkPostAction(ids, a);
      setResult({ ok: res.ok, text: res.ok ? (res.message ?? "Done.") : res.error });
      setSelected(new Set());
      setConfirming(false);
      setAction("");
      router.refresh();
    });
  }

  function apply() {
    if (!action) return setResult({ ok: false, text: "Choose an action first." });
    if (!selected.size) return setResult({ ok: false, text: "Select at least one story." });
    if (action === "delete" && !confirming) return setConfirming(true);
    run(action, [...selected]);
  }

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));

  if (!rows.length) {
    return (
      <div className="flex flex-col gap-4">
        {result ? <FormMessage tone={result.ok ? "success" : "error"}>{result.text}</FormMessage> : null}
        <p className="py-10 text-center text-muted">No stories here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="bulk-action" className="sr-only">Bulk action</label>
        <Select
          id="bulk-action"
          value={action}
          onChange={(e) => {
            setAction(e.target.value as BulkAction);
            setConfirming(false);
          }}
          className="w-auto min-w-48"
        >
          <option value="">Bulk actions</option>
          {actions.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </Select>
        {confirming ? (
          <>
            <span className="text-sm text-danger">Delete {selected.size} for good?</span>
            <Button variant="danger" size="sm" disabled={pending} onClick={apply}>Yes, delete</Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>Cancel</Button>
          </>
        ) : (
          <Button variant="outline" size="sm" disabled={pending} onClick={apply}>
            {pending ? "Applying…" : "Apply"}
          </Button>
        )}
        <span className="text-sm text-muted">{selected.size ? `${selected.size} selected` : ""}</span>
      </div>
      {result ? <FormMessage tone={result.ok ? "success" : "error"}>{result.text}</FormMessage> : null}

      <AdminTable>
        <thead>
          <tr>
            <th className="w-10">
              <input
                type="checkbox"
                aria-label="Select all"
                checked={allChecked}
                onChange={() => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)))}
                className="h-4 w-4 accent-[var(--accent)]"
              />
            </th>
            <th>Title</th>
            <th>Author</th>
            <th>Status</th>
            <th>Engagement</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const st = STATUS[r.status] ?? STATUS.draft;
            const live = r.status === "published" || r.status === "scheduled";
            return (
              <tr key={r.id} className={selected.has(r.id) ? "bg-accent-soft/40" : undefined}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Select ${r.title || "untitled story"}`}
                    checked={selected.has(r.id)}
                    onChange={() =>
                      setSelected((s) => {
                        const n = new Set(s);
                        if (n.has(r.id)) n.delete(r.id);
                        else n.add(r.id);
                        return n;
                      })
                    }
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                </td>
                <td className="max-w-[340px]">
                  {r.status === "trash" ? (
                    <span className="block truncate font-medium">{r.title || "Untitled story"}</span>
                  ) : (
                    <Link href={`/editor/${r.id}`} className="block truncate font-medium hover:underline">
                      {r.title || "Untitled story"}
                    </Link>
                  )}
                  <span className="flex gap-3 text-xs text-muted">
                    {r.status === "trash" ? (
                      <>
                        <button type="button" className="cursor-pointer hover:text-fg" onClick={() => run("restore", [r.id])}>Restore</button>
                      </>
                    ) : (
                      <>
                        <Link href={`/editor/${r.id}`} className="hover:text-fg">Edit</Link>
                        <Link href={`/p/${r.slug}`} className="hover:text-fg">{live ? "View" : "Preview"}</Link>
                        <button type="button" className="cursor-pointer hover:text-danger" onClick={() => run("trash", [r.id])}>Trash</button>
                      </>
                    )}
                  </span>
                </td>
                <td className="whitespace-nowrap">
                  <Link href={`/@${r.authorUsername}`} className="hover:underline">{r.authorName}</Link>
                </td>
                <td>
                  <span className="flex flex-wrap gap-1">
                    <Badge tone={st.tone}>{st.label}</Badge>
                    {r.featured ? <Badge tone="accent">Pick</Badge> : null}
                  </span>
                </td>
                <td className="whitespace-nowrap text-muted tabular-nums">
                  {compactNumber(r.viewCount)} views · {compactNumber(r.clapCount)} claps · {r.commentCount} resp.
                </td>
                <td className="whitespace-nowrap text-xs text-muted">
                  {r.status === "scheduled" ? "Goes live " : r.status === "published" ? "Published " : "Edited "}
                  {formatDate(r.status === "published" || r.status === "scheduled" ? r.publishedAt : r.updatedAt, { year: true })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </AdminTable>
    </div>
  );
}
