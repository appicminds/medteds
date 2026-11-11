"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export type TopicBarItem = { key: string; label: string; href: string };

/** Pages that show the topic bar. Story, editor, admin and account pages stay uncluttered. */
function showsBar(path: string) {
  return path === "/" || path === "/topics" || path === "/search" || path.startsWith("/tag/");
}

export function TopicBarNav({ items }: { items: TopicBarItem[] }) {
  const path = usePathname();
  const params = useSearchParams();
  const scroller = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const active =
    path === "/" ? params.get("tab") || "for-you" : path.startsWith("/tag/") ? decodeURIComponent(path.slice(5)) : path === "/topics" ? "explore" : "";

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () => setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    update();
    // Bring the active pill into view.
    el.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [path, active]);

  if (!showsBar(path)) return null;

  const scrollBy = (dx: number) => scroller.current?.scrollBy({ left: dx, behavior: "smooth" });
  const pill = (on: boolean) =>
    cn(
      "flex h-8 shrink-0 items-center gap-1 rounded-pill px-3.5 text-sm whitespace-nowrap transition-colors",
      on ? "bg-fg text-bg" : "bg-surface text-muted hover:text-fg",
    );

  return (
    <nav aria-label="Topics" className="sticky top-[57px] z-30 border-b border-line bg-bg">
      <div className="relative mx-auto max-w-page">
        {edges.left ? (
          <button
            type="button"
            aria-label="Scroll topics left"
            onClick={() => scrollBy(-240)}
            className="absolute left-0 top-0 z-10 hidden h-full cursor-pointer items-center bg-gradient-to-r from-bg via-bg to-transparent pl-3 pr-6 text-muted hover:text-fg sm:flex"
          >
            <ChevronLeft size={18} />
          </button>
        ) : null}
        <ul ref={scroller} className="flex gap-2 overflow-x-auto px-4 py-2.5 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden">
          <li className="shrink-0">
            <Link href="/topics" aria-label="Explore all topics" aria-current={active === "explore" ? "page" : undefined} className={pill(active === "explore")}>
              <Plus size={16} />
            </Link>
          </li>
          {items.map((it) => (
            <li key={it.key} className="shrink-0">
              <Link href={it.href} aria-current={active === it.key ? "page" : undefined} className={pill(active === it.key)}>
                {it.label}
              </Link>
            </li>
          ))}
        </ul>
        {edges.right ? (
          <button
            type="button"
            aria-label="Scroll topics right"
            onClick={() => scrollBy(240)}
            className="absolute right-0 top-0 z-10 hidden h-full cursor-pointer items-center bg-gradient-to-l from-bg via-bg to-transparent pl-6 pr-3 text-muted hover:text-fg sm:flex"
          >
            <ChevronRight size={18} />
          </button>
        ) : null}
      </div>
    </nav>
  );
}
