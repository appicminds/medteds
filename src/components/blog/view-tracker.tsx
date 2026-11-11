"use client";

import { useEffect } from "react";

/** Reports one view of this story after the page has been open for a moment. */
export function ViewTracker({ postId }: { postId: string }) {
  useEffect(() => {
    const t = setTimeout(() => {
      fetch("/api/views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
        keepalive: true,
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [postId]);
  return null;
}
