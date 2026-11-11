import Link from "next/link";
import { AdminHeader } from "@/components/admin/page-header";
import { SeoTable } from "@/components/admin/seo-table";
import { SiteSeoForm, TopicSeoTable } from "@/components/admin/seo-forms";
import { Input } from "@/components/ui/field";
import { LinkTabs } from "@/components/ui/tabs";
import { adminListSeo, adminListTopicSeo, SEO_FILTERS, type SeoFilter } from "@/lib/queries";
import { siteOrigin } from "@/lib/seo";
import { requireCan } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

export const metadata = { title: "SEO" };

const TABS = [
  { key: "stories", label: "Stories" },
  { key: "pages", label: "Pages" },
  { key: "topics", label: "Topics" },
  { key: "site", label: "Site" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default async function AdminSeo({ searchParams }: PageProps<"/admin/seo">) {
  await requireCan("manageSeo", "/admin/seo");
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const tab: Tab = TABS.some((t) => t.key === str("tab")) ? (str("tab") as Tab) : "stories";
  const filter: SeoFilter = SEO_FILTERS.some((f) => f.key === str("filter")) ? (str("filter") as SeoFilter) : "all";
  const q = str("q");
  const page = Math.max(1, Number(str("page")) || 1);
  const settings = await getSettings();
  const host = siteOrigin().replace(/^https?:\/\//, "");

  const link = (patch: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged = { tab, filter, q, page: undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) {
      if (v === undefined || v === "" || (k === "tab" && v === "stories") || (k === "filter" && v === "all") || (k === "page" && String(v) === "1")) continue;
      params.set(k, String(v));
    }
    const s = params.toString();
    return `/admin/seo${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <AdminHeader
        title="SEO"
        description="Search titles, descriptions and sharing images are filled in automatically. Override any of them here."
      />
      <LinkTabs className="mb-6" active={tab} items={TABS.map((t) => ({ key: t.key, label: t.label, href: link({ tab: t.key, filter: undefined, q: undefined }) }))} />

      {tab === "stories" || tab === "pages" ? (
        <ListTab kind={tab} filter={filter} q={q} page={page} link={link} host={host} siteName={settings.siteName} defaultImage={settings.defaultShareImage} />
      ) : tab === "topics" ? (
        <>
          <p className="mb-4 text-sm text-muted">Blank fields use the topic&apos;s name and description automatically.</p>
          <TopicSeoTable topics={await adminListTopicSeo()} />
        </>
      ) : (
        <SiteSeoForm
          siteName={settings.siteName}
          auto={{
            title: settings.tagline ? `${settings.siteName}: ${settings.tagline}` : settings.siteName,
            description: settings.tagline,
          }}
          initial={{
            homeSeoTitle: settings.homeSeoTitle,
            homeSeoDescription: settings.homeSeoDescription,
            titleSeparator: (["·", "|", "–", "-", "—", ":"].includes(settings.titleSeparator) ? settings.titleSeparator : "·") as "·",
            searchVisible: settings.searchVisible,
            defaultShareImage: settings.defaultShareImage ?? "",
            twitterHandle: settings.twitterHandle,
            googleVerification: settings.googleVerification,
          }}
        />
      )}
    </>
  );
}

async function ListTab({
  kind,
  filter,
  q,
  page,
  link,
  host,
  siteName,
  defaultImage,
}: {
  kind: "stories" | "pages";
  filter: SeoFilter;
  q: string;
  page: number;
  link: (patch: Record<string, string | number | undefined>) => string;
  host: string;
  siteName: string;
  defaultImage: string | null;
}) {
  const { rows, hasMore, counts } = await adminListSeo({ kind, filter, query: q || undefined, page, defaultImage });
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter" className="flex flex-wrap gap-2">
          {SEO_FILTERS.map((f) => (
            <Link
              key={f.key}
              href={link({ filter: f.key })}
              aria-current={f.key === filter ? "page" : undefined}
              className={cn(
                "rounded-pill px-3 py-1.5 text-sm transition-colors",
                f.key === filter ? "bg-fg text-bg" : "bg-surface text-muted hover:text-fg",
              )}
            >
              {f.label} <span className="tabular-nums">({counts[f.key]})</span>
            </Link>
          ))}
        </nav>
        <form action="/admin/seo" className="flex w-full gap-2 sm:w-auto">
          {kind !== "stories" ? <input type="hidden" name="tab" value={kind} /> : null}
          {filter !== "all" ? <input type="hidden" name="filter" value={filter} /> : null}
          <label htmlFor="seo-q" className="sr-only">Search</label>
          <Input id="seo-q" name="q" type="search" defaultValue={q} placeholder={`Search ${kind}`} className="w-full sm:w-56" />
          <button type="submit" className="h-10 shrink-0 cursor-pointer rounded-md border border-line px-4 text-sm hover:bg-surface">Search</button>
        </form>
      </div>

      <SeoTable key={`${kind}-${filter}-${q}-${page}`} rows={rows} kind={kind} host={host} siteName={siteName} />

      {page > 1 || hasMore ? (
        <div className="mt-6 flex justify-between text-sm">
          {page > 1 ? <Link href={link({ page: page - 1 })} className="text-accent hover:underline">← Newer</Link> : <span />}
          {hasMore ? <Link href={link({ page: page + 1 })} className="text-accent hover:underline">Older →</Link> : null}
        </div>
      ) : null}
    </>
  );
}
