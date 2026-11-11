/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Lock } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

/** A reading list as a card: name, owner, story count and up to three cover thumbnails. */
export function ListCard({
  href,
  name,
  count,
  covers,
  isPublic,
  owner,
  description,
}: {
  href: string;
  name: string;
  count: number;
  covers: string[];
  isPublic: boolean;
  owner?: { name: string; image: string | null };
  description?: string | null;
}) {
  return (
    <Link href={href} className="flex min-w-0 overflow-hidden rounded-md border border-line bg-bg transition-colors hover:border-fg">
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-5">
        {owner ? (
          <span className="flex items-center gap-2 text-xs text-muted">
            <Avatar name={owner.name} src={owner.image} size="xs" /> {owner.name}
          </span>
        ) : null}
        <span className="truncate text-lg font-bold">{name}</span>
        {description ? <span className="line-clamp-2 text-sm text-muted">{description}</span> : null}
        <span className="mt-auto flex items-center gap-2 text-xs text-muted">
          {count} {count === 1 ? "story" : "stories"}
          {!isPublic ? (
            <>
              · <Lock size={12} aria-hidden /> Private
            </>
          ) : null}
        </span>
      </div>
      <div className="relative hidden w-40 shrink-0 bg-surface sm:block" aria-hidden>
        {covers.slice(0, 3).map((src, i) => (
          <img
            key={src + i}
            src={src}
            alt=""
            className="absolute top-0 h-full w-24 border-l-2 border-bg object-cover"
            style={{ left: `${i * 32}px`, zIndex: 3 - i }}
          />
        ))}
      </div>
    </Link>
  );
}
