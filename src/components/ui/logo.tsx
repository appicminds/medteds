import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-serif text-[26px] font-bold tracking-tight text-fg">
      <span aria-hidden className="h-[26px] w-[26px] rounded-[50%_50%_50%_4px] bg-accent" />
      MedTeds
    </Link>
  );
}
