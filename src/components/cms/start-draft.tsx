"use client";

import { useEffect, useRef } from "react";
import { createDraft } from "@/lib/post-actions";

export function StartDraft() {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void createDraft();
  }, []);
  return <p className="py-24 text-center text-muted" aria-live="polite">Opening a new draft…</p>;
}
