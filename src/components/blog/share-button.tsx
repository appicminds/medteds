"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  async function onClick() {
    const url = location.href.split("#")[0];
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
    } catch {}
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={copied ? "Link copied" : "Copy link"}
      title={copied ? "Link copied" : "Copy link"}
      className="inline-flex cursor-pointer text-muted hover:text-fg"
    >
      {copied ? <Check size={22} /> : <Link2 size={22} strokeWidth={1.6} />}
    </button>
  );
}
