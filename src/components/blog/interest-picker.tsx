"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import { setTopicFollows } from "@/lib/actions";
import { cn } from "@/lib/utils";

const MIN = 3;

export function InterestPicker({ topics, initial, next }: { topics: { id: number; name: string }[]; initial: number[]; next: string }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<number>>(new Set(initial));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toggle = (id: number) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const left = Math.max(0, MIN - picked.size);

  return (
    <div className="flex flex-col gap-8">
      <ul className="flex flex-wrap justify-center gap-2.5" aria-label="Topics">
        {topics.map((t) => {
          const on = picked.has(t.id);
          return (
            <li key={t.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(t.id)}
                className={cn(
                  "inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-pill border px-4 text-sm transition-colors",
                  on ? "border-fg bg-fg text-bg" : "border-line bg-bg hover:border-fg",
                )}
              >
                {on ? <Check size={15} aria-hidden /> : null}
                {t.name}
              </button>
            </li>
          );
        })}
      </ul>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <div className="flex flex-col items-center gap-3">
        <Button
          variant="solid"
          disabled={pending || left > 0}
          onClick={() =>
            start(async () => {
              const res = await setTopicFollows([...picked]);
              if (!res.ok) return setError(res.error);
              router.push(next);
              router.refresh();
            })
          }
        >
          {pending ? "Saving…" : left > 0 ? `Pick ${left} more` : "Continue"}
        </Button>
        <button type="button" className="cursor-pointer text-sm text-muted hover:text-fg" onClick={() => router.push(next)}>
          Skip for now
        </button>
      </div>
    </div>
  );
}
