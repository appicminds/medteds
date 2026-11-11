"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bookmark } from "lucide-react";
import { toggleBookmark } from "@/lib/actions";
import { cn } from "@/lib/utils";

export function BookmarkButton({ postId, saved, signedIn, size = 20 }: { postId: string; saved: boolean; signedIn: boolean; size?: number }) {
  const [on, setOn] = useState(saved);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={on}
      aria-label={on ? "Remove from reading list" : "Save to reading list"}
      title={on ? "Saved to your reading list" : "Save to reading list"}
      onClick={() => {
        if (!signedIn) return router.push(`/signin?next=${encodeURIComponent(location.pathname)}`);
        setOn(!on);
        start(async () => {
          const res = await toggleBookmark(postId);
          if (res !== null) setOn(res);
        });
      }}
      className={cn("inline-flex cursor-pointer transition-colors", on ? "text-fg" : "text-muted hover:text-fg")}
    >
      <Bookmark size={size} strokeWidth={1.6} fill={on ? "currentColor" : "none"} />
    </button>
  );
}
