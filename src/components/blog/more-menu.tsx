"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ellipsis, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage, Textarea } from "@/components/ui/field";
import { reportContent, toggleMute } from "@/lib/actions";
import { REPORT_REASON_LABELS, REPORT_REASONS, type ReportReason } from "@/lib/report-reasons";
import { cn } from "@/lib/utils";

type Target = { postId?: string; commentId?: string };

/** "…" menu on a story or response: mute the writer or topic, or report it. */
export function MoreMenu({
  target,
  label,
  writer,
  topic,
  signedIn,
  size = 20,
}: {
  target: Target;
  label: string;
  writer?: { id: string; name: string; muted: boolean } | null;
  topic?: { id: number; name: string; muted: boolean } | null;
  signedIn: boolean;
  size?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [, start] = useTransition();
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function needSignIn() {
    if (signedIn) return false;
    router.push(`/signin?next=${encodeURIComponent(location.pathname)}`);
    return true;
  }

  function mute(type: "user" | "topic", id: string, name: string) {
    if (needSignIn()) return;
    setOpen(false);
    start(async () => {
      const res = await toggleMute(type, id);
      if (res === null) return;
      setDone(res ? `Muted ${name}. You won't see their ${type === "user" ? "stories or responses" : "stories"} in your feeds.` : `Unmuted ${name}.`);
      router.refresh();
    });
  }

  const item = "flex w-full cursor-pointer items-center rounded-sm px-3 py-2 text-left text-sm hover:bg-surface";

  return (
    <div ref={wrap} className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex cursor-pointer text-muted hover:text-fg"
      >
        <Ellipsis size={size} />
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-56 rounded-md border border-line bg-bg p-1.5 shadow-pop">
          {writer ? (
            <button type="button" role="menuitem" className={item} onClick={() => mute("user", writer.id, writer.name)}>
              {writer.muted ? `Unmute ${writer.name}` : `Mute ${writer.name}`}
            </button>
          ) : null}
          {topic ? (
            <button type="button" role="menuitem" className={item} onClick={() => mute("topic", String(topic.id), topic.name)}>
              {topic.muted ? `Unmute ${topic.name}` : `Show less ${topic.name}`}
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className={cn(item, "text-danger")}
            onClick={() => {
              if (needSignIn()) return;
              setOpen(false);
              setReporting(true);
            }}
          >
            Report {target.postId ? "story" : "response"}
          </button>
        </div>
      ) : null}
      {done ? (
        <div role="status" className="fixed bottom-6 left-1/2 z-50 flex w-[min(92vw,420px)] -translate-x-1/2 items-start gap-3 rounded-md bg-fg px-4 py-3 text-sm text-bg shadow-pop">
          <span className="flex-1">{done}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setDone(null)} className="cursor-pointer opacity-80 hover:opacity-100">
            <X size={16} />
          </button>
        </div>
      ) : null}
      {reporting ? <ReportDialog target={target} onClose={() => setReporting(false)} onDone={(m) => setDone(m)} /> : null}
    </div>
  );
}

function ReportDialog({ target, onClose, onDone }: { target: Target; onClose: () => void; onDone: (message: string) => void }) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-fg/40 px-4 py-12" role="dialog" aria-modal="true" aria-labelledby="report-title" onClick={onClose}>
      <form
        className="w-full max-w-md rounded-lg bg-bg p-6 shadow-pop"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!reason) return setError("Choose a reason.");
          start(async () => {
            const res = await reportContent({ ...target, reason, note });
            if (!res.ok) return setError(res.error);
            onClose();
            onDone(res.message ?? "Reported.");
          });
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="report-title" className="text-xl font-bold">Report {target.postId ? "story" : "response"}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="cursor-pointer text-muted hover:text-fg">
            <X size={20} />
          </button>
        </div>
        <fieldset className="mt-5 flex flex-col gap-2 text-sm">
          <legend className="mb-2 text-muted">What&apos;s the problem?</legend>
          {REPORT_REASONS.map((r) => (
            <label key={r} className="flex cursor-pointer items-center gap-2.5">
              <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} className="accent-[var(--accent)]" />
              {REPORT_REASON_LABELS[r]}
            </label>
          ))}
        </fieldset>
        <label htmlFor="report-note" className="mt-5 block text-sm font-medium">
          Anything else? <span className="font-normal text-muted">(optional)</span>
        </label>
        <Textarea id="report-note" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} className="mt-1.5 min-h-20" />
        {error ? (
          <div className="mt-3">
            <FormMessage tone="error">{error}</FormMessage>
          </div>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="danger" size="sm" disabled={pending}>
            {pending ? "Sending…" : "Send report"}
          </Button>
        </div>
      </form>
    </div>
  );
}
