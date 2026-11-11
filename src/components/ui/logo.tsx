/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

export function Logo({ name = "MedTeds", logoUrl }: { name?: string; logoUrl?: string | null }) {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2 font-serif text-[26px] font-bold tracking-tight text-fg">
      {logoUrl ? (
        <img src={logoUrl} alt="" className="h-[28px] w-[28px] shrink-0 rounded-sm object-contain" />
      ) : (
        <span aria-hidden className="h-[26px] w-[26px] shrink-0 rounded-[50%_50%_50%_4px] bg-accent" />
      )}
      <span className="truncate">{name}</span>
    </Link>
  );
}
