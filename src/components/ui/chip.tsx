import Link from "next/link";
import { cn } from "@/lib/utils";

const chip = "inline-flex items-center rounded-pill bg-surface px-4 py-2 text-sm text-fg transition-colors";

export function Chip({ href, active, children, className }: { href?: string; active?: boolean; children: React.ReactNode; className?: string }) {
  const cls = cn(chip, href && "hover:bg-accent-soft hover:text-accent", active && "bg-fg text-bg hover:bg-fg hover:text-bg", className);
  return href ? (
    <Link href={href} className={cls}>
      {children}
    </Link>
  ) : (
    <span className={cls}>{children}</span>
  );
}
