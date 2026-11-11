"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/field";
import { adminSaveTopic } from "@/lib/actions";

export function TopicForm({ topic }: { topic?: { id: number; name: string; description: string } }) {
  const [state, action, pending] = useActionState(adminSaveTopic, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && !topic) ref.current?.reset();
  }, [state, topic]);
  return (
    <form ref={ref} action={action} className="flex flex-col gap-4">
      {topic ? <input type="hidden" name="id" value={topic.id} /> : null}
      <Field label="Name" htmlFor="topic-name">
        <Input id="topic-name" name="name" defaultValue={topic?.name} required maxLength={40} placeholder="e.g. Dermatology" />
      </Field>
      <Field label="Description" htmlFor="topic-description" hint="Shown at the top of the topic page.">
        <Textarea id="topic-description" name="description" defaultValue={topic?.description} maxLength={200} />
      </Field>
      {state ? <FormMessage tone={state.ok ? "success" : "error"}>{state.ok ? state.message : state.error}</FormMessage> : null}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : topic ? "Save changes" : "Add topic"}
        </Button>
        {topic ? (
          <Link href="/admin/topics" className="text-sm text-muted hover:text-fg">
            Cancel
          </Link>
        ) : null}
      </div>
    </form>
  );
}
