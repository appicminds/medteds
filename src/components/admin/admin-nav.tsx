"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, LayoutDashboard, MessageCircle, Tags, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/stories", label: "Stories", icon: FileText },
  { href: "/admin/users", label: "Members", icon: Users },
  { href: "/admin/topics", label: "Topics", icon: Tags },
  { href: "/admin/comments", label: "Responses", icon: MessageCircle },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="flex gap-1 overflow-x-auto md:sticky md:top-[89px] md:flex-col md:self-start">
      <p className="hidden px-3 pb-2 text-xs uppercase tracking-[0.12em] text-muted md:block">Admin</p>
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? path === href : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
              active ? "bg-surface font-medium text-fg" : "text-muted hover:bg-surface hover:text-fg",
            )}
          >
            <Icon size={17} /> {label}
          </Link>
        );
      })}
    </nav>
  );
}
