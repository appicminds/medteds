"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { handleReport, type ReportAction } from "@/lib/actions";

export function ReportActions({ id, kind, canRemove }: { id: string; kind: "story" | "response"; canRemove: boolean }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (a: ReportAction) =>
    start(async () => {
      const res = await handleReport(id, a);
      // Keep the report on screen with the outcome; the list updates on the next visit.
      setMsg(res.ok ? { ok: true, text: res.message ?? "Done." } : { ok: false, text: res.error });
    });
  if (msg?.ok) return <p className="text-sm text-success">{msg.text}</p>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {canRemove ? (
        <Button variant="danger" size="sm" disabled={pending} onClick={() => run("resolve-remove")}>
          {kind === "story" ? "Move story to trash" : "Mark response as spam"}
        </Button>
      ) : null}
      <Button variant="outline" size="sm" disabled={pending} onClick={() => run("resolve")}>
        Resolve
      </Button>
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => run("dismiss")}>
        Dismiss
      </Button>
      {msg && !msg.ok ? <p className="basis-full text-sm text-danger">{msg.text}</p> : null}
    </div>
  );
}
