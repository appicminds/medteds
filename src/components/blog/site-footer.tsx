import Link from "next/link";
import { getSettings } from "@/lib/settings";

const SOCIAL_LABELS = { website: "Website", twitter: "X", linkedin: "LinkedIn", instagram: "Instagram", youtube: "YouTube" } as const;

export async function SiteFooter() {
  const s = await getSettings();
  const social = (Object.keys(SOCIAL_LABELS) as (keyof typeof SOCIAL_LABELS)[]).filter((k) => s.social[k]);
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-page flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          © {new Date().getFullYear()} {s.siteName}
          {s.tagline ? <span className="hidden md:inline"> · {s.tagline}</span> : null}
        </p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-2">
          {s.footerMenu.map((m, i) => (
            <Link key={i} href={m.url} className="hover:text-fg">
              {m.label}
            </Link>
          ))}
          {social.map((k) => (
            <a key={k} href={s.social[k]} target="_blank" rel="noopener noreferrer" className="hover:text-fg">
              {SOCIAL_LABELS[k]}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
