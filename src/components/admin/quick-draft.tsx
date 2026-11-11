"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage, Input, Textarea } from "@/components/ui/field";
import { quickDraft } from "@/lib/post-actions";

export function QuickDraft() {
  const [state, action, pending] = useActionState(quickDraft, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="flex flex-col gap-3">
      <label htmlFor="qd-title" className="sr-only">Title</label>
      <Input id="qd-title" name="title" placeholder="Title" maxLength={200} />
      <label htmlFor="qd-body" className="sr-only">{"What's on your mind?"}</label>
      <Textarea id="qd-body" name="body" placeholder="What's on your mind?" className="min-h-24" />
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      {state?.ok ? (
        <FormMessage tone="success">
          Draft saved. <Link href={`/editor/${state.message}`} className="underline">Open it in the editor</Link>
        </FormMessage>
      ) : null}
      <div>
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save draft"}
        </Button>
      </div>
    </form>
  );
}
