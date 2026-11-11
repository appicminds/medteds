"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clapStory } from "@/lib/actions";
import { cn, compactNumber } from "@/lib/utils";

const MAX = 50;

export function ClapIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
      <path d="M7 11V5a1.5 1.5 0 0 1 3 0v5m0-1V3.5a1.5 1.5 0 0 1 3 0V10m0-4.5a1.5 1.5 0 0 1 3 0V12m0-3a1.5 1.5 0 0 1 3 0v5a7 7 0 0 1-7 7h-1a7 7 0 0 1-5.6-2.8L3.3 14a1.5 1.5 0 0 1 2.4-1.8L7 14" />
    </svg>
  );
}

/** Each click adds a clap (up to 50 per reader). Clicks are batched and sent together. */
export function ClapButton({
  postId,
  total,
  mine,
  signedIn,
  isAuthor,
}: {
  postId: string;
  total: number;
  mine: number;
  signedIn: boolean;
  isAuthor: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState({ total, mine });
  const [burst, setBurst] = useState(0);
  const pending = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, startTransition] = useTransition();

  function flush() {
    const n = pending.current;
    pending.current = 0;
    if (!n) return;
    startTransition(async () => {
      const res = await clapStory(postId, n);
      if (res) setState(res);
    });
  }

  function onClick() {
    if (!signedIn) {
      router.push(`/signin?next=${encodeURIComponent(location.pathname)}`);
      return;
    }
    if (isAuthor || state.mine >= MAX) return;
    pending.current += 1;
    setState((s) => ({ total: s.total + 1, mine: s.mine + 1 }));
    setBurst((b) => b + 1);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 600);
  }

  const label = isAuthor
    ? "You can't clap for your own story"
    : state.mine >= MAX
      ? "You've given the maximum 50 claps"
      : `Clap for this story (${state.mine} of ${MAX})`;

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "relative inline-flex cursor-pointer items-center gap-1.5 text-sm transition-colors",
        state.mine > 0 ? "text-accent" : "text-muted hover:text-fg",
      )}
    >
      <ClapIcon />
      <span className="tabular-nums">{compactNumber(state.total)}</span>
      {burst > 0 && state.mine > 0 ? (
        <span
          key={burst}
          aria-hidden
          className="pointer-events-none absolute -top-8 left-0 grid h-7 min-w-7 place-items-center rounded-full bg-fg px-1.5 text-xs font-medium text-bg [animation:clapPop_700ms_ease-out_forwards]"
        >
          +{state.mine}
        </span>
      ) : null}
      <style>{`@keyframes clapPop{0%{opacity:0;transform:translateY(6px)}20%{opacity:1;transform:translateY(0)}80%{opacity:1}100%{opacity:0;transform:translateY(-6px)}}`}</style>
    </button>
  );
}
