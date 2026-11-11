"use client";

import { useEffect, useState, useTransition } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import { getRevision, restoreRevision, saveRevision, type SaveInput } from "@/lib/post-actions";
import { cn } from "@/lib/utils";

export type RevisionRow = { id: string; title: string; createdAt: string; savedByName: string | null };

function when(iso: string) {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function RevisionsDialog({
  open,
  onClose,
  revisions,
  getPayload,
  onRestored,
}: {
  open: boolean;
  onClose: () => void;
  revisions: RevisionRow[];
  getPayload: () => SaveInput;
  onRestored: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(revisions[0]?.id ?? null);
  const [preview, setPreview] = useState<{ title: string; subtitle: string | null; text: string } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open || !selected) return;
    let live = true;
    getRevision(selected).then((r) => live && setPreview(r));
    return () => {
      live = false;
    };
  }, [open, selected]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-fg/40 px-4 py-10" role="dialog" aria-modal="true" aria-labelledby="revisions-title">
      <div className="w-full max-w-3xl rounded-lg bg-bg p-6 shadow-pop">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="revisions-title" className="text-2xl font-bold">Revisions</h2>
            <p className="mt-1 text-sm text-muted">A version is saved each time the story is published or updated. Restoring one keeps your current text as a revision too.</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="cursor-pointer text-muted hover:text-fg">
            <X size={22} />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await saveRevision(getPayload());
                setMsg(res.ok ? { ok: true, text: "Revision saved. Reopen this list to see it." } : { ok: false, text: res.error });
              })
            }
          >
            Save current version
          </Button>
        </div>
        {msg ? (
          <div className="mt-3">
            <FormMessage tone={msg.ok ? "success" : "error"}>{msg.text}</FormMessage>
          </div>
        ) : null}

        {revisions.length ? (
          <div className="mt-5 grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
            <ul className="flex max-h-[50vh] flex-col overflow-y-auto rounded-md border border-line">
              {revisions.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(r.id)}
                    aria-pressed={r.id === selected}
                    className={cn(
                      "w-full cursor-pointer border-b border-line px-3 py-2.5 text-left text-sm last:border-0",
                      r.id === selected ? "bg-surface font-medium" : "hover:bg-surface",
                    )}
                  >
                    <span className="block">{when(r.createdAt)}</span>
                    <span className="block truncate text-xs text-muted">{r.savedByName ?? "Unknown"}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="min-w-0 rounded-md border border-line p-4">
              {preview ? (
                <>
                  <h3 className="text-xl font-bold">{preview.title || "Untitled story"}</h3>
                  {preview.subtitle ? <p className="mt-1 text-muted">{preview.subtitle}</p> : null}
                  <p className="mt-4 max-h-[40vh] overflow-y-auto whitespace-pre-line font-serif text-[15px] leading-6">{preview.text}</p>
                  <div className="mt-4 border-t border-line pt-4">
                    <Button
                      variant="accent"
                      size="sm"
                      disabled={pending || !selected}
                      onClick={() =>
                        start(async () => {
                          const res = await restoreRevision(selected!);
                          if (res.ok) onRestored();
                          else setMsg({ ok: false, text: res.error });
                        })
                      }
                    >
                      {pending ? "Restoring…" : "Restore this version"}
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted">Loading…</p>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted">No revisions yet. One is saved when you publish, or click “Save current version”.</p>
        )}
      </div>
    </div>
  );
}
