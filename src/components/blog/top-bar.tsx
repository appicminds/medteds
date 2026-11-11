import Link from "next/link";
import { Search, SquarePen } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { ButtonLink } from "@/components/ui/button";
import { UserMenu } from "@/components/blog/user-menu";
import { TopicBar } from "@/components/blog/topic-bar";
import { getCurrentUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";

export async function TopBar() {
  const [me, settings] = await Promise.all([getCurrentUser(), getSettings()]);
  return (
    <>
    <header className="sticky top-0 z-40 border-b border-line bg-bg">
      <div className="flex h-[57px] items-center gap-4 px-4 sm:px-6">
        <Logo name={settings.siteName} logoUrl={settings.logoUrl} />
        <form action="/search" className="hidden items-center gap-2 rounded-pill bg-surface px-4 py-2 text-muted sm:flex">
          <Search size={18} aria-hidden />
          <label htmlFor="site-search" className="sr-only">
            Search {settings.siteName}
          </label>
          <input
            id="site-search"
            name="q"
            type="search"
            placeholder={`Search ${settings.siteName}`}
            className="w-48 bg-transparent text-sm text-fg outline-none placeholder:text-muted lg:w-56"
          />
        </form>
        <div className="flex-1" />
        <Link href="/search" aria-label="Search" className="text-muted hover:text-fg sm:hidden">
          <Search size={22} />
        </Link>
        {can(me, "write") ? (
          <Link href="/write" className="flex items-center gap-1.5 text-sm text-muted hover:text-fg">
            <SquarePen size={22} strokeWidth={1.6} />
            <span className="hidden sm:inline">Write</span>
          </Link>
        ) : null}
        {me ? (
          <UserMenu user={me} canWrite={can(me, "write")} canAdmin={can(me, "viewAdmin")} />
        ) : (
          <>
            {settings.signupOpen ? (
              <ButtonLink href="/signup" variant="solid" size="sm">
                Sign up
              </ButtonLink>
            ) : null}
            <Link href="/signin" className={settings.signupOpen ? "hidden text-sm text-muted hover:text-fg sm:inline" : "text-sm text-muted hover:text-fg"}>
              Sign in
            </Link>
          </>
        )}
      </div>
    </header>
    {settings.headerMenu.length ? (
      <nav aria-label="Main" className="border-b border-line">
        <ul className="flex gap-6 overflow-x-auto px-4 py-2.5 text-sm [scrollbar-width:none] sm:px-6">
          {settings.headerMenu.map((m, i) => (
            <li key={i} className="shrink-0">
              <Link href={m.url} className="text-muted hover:text-fg">
                {m.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    ) : null}
    <TopicBar />
    </>
  );
}
