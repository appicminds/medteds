"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bookmark, FileText, LogOut, Settings, Shield, User } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/blog/theme-toggle";
import { signOut } from "@/lib/auth-client";

export function UserMenu({
  user,
  canWrite,
  canAdmin,
}: {
  user: { name: string; email: string; username: string; image: string | null };
  canWrite: boolean;
  canAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const item = "flex items-center gap-3 px-5 py-2 text-sm text-muted hover:text-fg";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex cursor-pointer rounded-full"
      >
        <Avatar name={user.name} src={user.image} size="sm" />
      </button>
      {open ? (
        <div className="absolute right-0 top-11 z-50 w-64 rounded-md border border-line bg-bg py-3 shadow-pop">
          <Link href={`/@${user.username}`} onClick={() => setOpen(false)} className="flex items-center gap-3 px-5 pb-3">
            <Avatar name={user.name} src={user.image} size="md" />
            <span className="min-w-0">
              <span className="block truncate font-medium">{user.name}</span>
              <span className="block truncate text-xs text-muted">View profile</span>
            </span>
          </Link>
          <div className="border-t border-line pt-2">
            {canWrite ? (
              <Link href="/me/stories" className={item} onClick={() => setOpen(false)}>
                <FileText size={18} /> Your stories
              </Link>
            ) : null}
            <Link href="/reading-list" className={item} onClick={() => setOpen(false)}>
              <Bookmark size={18} /> Reading list
            </Link>
            <Link href={`/@${user.username}`} className={item} onClick={() => setOpen(false)}>
              <User size={18} /> Profile
            </Link>
            <Link href="/settings" className={item} onClick={() => setOpen(false)}>
              <Settings size={18} /> Settings
            </Link>
            {canAdmin ? (
              <Link href="/admin" className={item} onClick={() => setOpen(false)}>
                <Shield size={18} /> Admin
              </Link>
            ) : null}
          </div>
          <div className="mt-2 border-t border-line px-5 pt-3">
            <ThemeToggle />
          </div>
          <div className="mt-3 border-t border-line pt-2">
            <button
              type="button"
              className={item + " w-full cursor-pointer"}
              onClick={async () => {
                await signOut();
                router.push("/");
                router.refresh();
              }}
            >
              <LogOut size={18} /> Sign out
            </button>
            <p className="truncate px-5 text-xs text-muted">{user.email}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
