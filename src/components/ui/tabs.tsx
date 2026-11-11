import Link from "next/link";
import { cn } from "@/lib/utils";

export function LinkTabs({ items, active, className }: { items: { href: string; label: string; key: string }[]; active: string; className?: string }) {
  return (
    <nav className={cn("flex gap-8 overflow-x-auto border-b border-line [scrollbar-width:none]", className)}>
      {items.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? "page" : undefined}
          className={cn(
            "-mb-px whitespace-nowrap border-b pb-4 text-sm transition-colors",
            t.key === active ? "border-fg text-fg" : "border-transparent text-muted hover:text-fg",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
