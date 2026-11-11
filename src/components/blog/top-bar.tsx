import Link from "next/link";
import { Search, SquarePen } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { ButtonLink } from "@/components/ui/button";
import { UserMenu } from "@/components/blog/user-menu";
import { getCurrentUser } from "@/lib/session";

export async function TopBar() {
  const me = await getCurrentUser();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg">
      <div className="flex h-[57px] items-center gap-4 px-4 sm:px-6">
        <Logo />
        <form action="/search" className="hidden items-center gap-2 rounded-pill bg-surface px-4 py-2 text-muted sm:flex">
          <Search size={18} aria-hidden />
          <label htmlFor="site-search" className="sr-only">
            Search MedTeds
          </label>
          <input
            id="site-search"
            name="q"
            type="search"
            placeholder="Search MedTeds"
            className="w-48 bg-transparent text-sm text-fg outline-none placeholder:text-muted lg:w-56"
          />
        </form>
        <div className="flex-1" />
        <Link href="/search" aria-label="Search" className="text-muted hover:text-fg sm:hidden">
          <Search size={22} />
        </Link>
        <Link href="/write" className="flex items-center gap-1.5 text-sm text-muted hover:text-fg">
          <SquarePen size={22} strokeWidth={1.6} />
          <span className="hidden sm:inline">Write</span>
        </Link>
        {me ? (
          <UserMenu user={me} />
        ) : (
          <>
            <ButtonLink href="/signup" variant="solid" size="sm">
              Sign up
            </ButtonLink>
            <Link href="/signin" className="hidden text-sm text-muted hover:text-fg sm:inline">
              Sign in
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
