"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Image as ImageIcon, LayoutDashboard, Menu, MessageCircle, Settings, StickyNote, Tags, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const ALL = {
  dashboard: { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  posts: { href: "/admin/stories", label: "Posts", icon: FileText },
  media: { href: "/admin/media", label: "Media", icon: ImageIcon },
  pages: { href: "/admin/pages", label: "Pages", icon: StickyNote },
  comments: { href: "/admin/comments", label: "Comments", icon: MessageCircle },
  topics: { href: "/admin/topics", label: "Topics", icon: Tags },
  users: { href: "/admin/users", label: "Users", icon: Users },
  menus: { href: "/admin/menus", label: "Menus", icon: Menu },
  settings: { href: "/admin/settings", label: "Settings", icon: Settings },
} as const;

export type AdminNavKey = keyof typeof ALL;

export function AdminNav({ items }: { items: AdminNavKey[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="flex gap-1 overflow-x-auto md:sticky md:top-[89px] md:flex-col md:self-start">
      <p className="hidden px-3 pb-2 text-xs uppercase tracking-[0.12em] text-muted md:block">Admin</p>
      {items.map((key) => {
        const { href, label, icon: Icon } = ALL[key];
        const active = href === "/admin" ? path === href : path.startsWith(href);
        return (
          <Link
            key={key}
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
