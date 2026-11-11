import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import type { JSONContent } from "@tiptap/core";
import { cache } from "react";
import { db } from "@/db";
import { pages } from "@/db/schema";
import { renderStoryHtml } from "@/lib/content";
import { can } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { formatDate } from "@/lib/utils";
import { alternatesFor, robotsFor, shareImages } from "@/lib/seo";

const getPage = cache(async (slug: string) => db.query.pages.findFirst({ where: eq(pages.slug, slug) }));

export async function generateMetadata({ params }: PageProps<"/[page]">): Promise<Metadata> {
  const { page: slug } = await params;
  const [page, settings] = await Promise.all([getPage(decodeURIComponent(slug)), getSettings()]);
  if (!page || page.status !== "published") return { title: "Page not found", robots: { index: false, follow: false } };
  const title = page.seoTitle || page.title;
  const description = page.seoDescription || undefined;
  return {
    title,
    description,
    alternates: alternatesFor(`/${page.slug}`),
    robots: robotsFor(settings, page.noindex),
    openGraph: { siteName: settings.siteName, type: "website", title, description, url: `/${page.slug}`, images: shareImages(settings) },
  };
}

export default async function SitePage({ params }: PageProps<"/[page]">) {
  const { page: slug } = await params;
  const [page, me, settings] = await Promise.all([getPage(decodeURIComponent(slug)), getCurrentUser(), getSettings()]);
  if (!page) notFound();
  const canEdit = can(me, "managePages");
  if (page.status !== "published" && !canEdit) notFound();
  const html = await renderStoryHtml(page.content as JSONContent);

  return (
    <main className="mx-auto max-w-[728px] px-4 pb-24 pt-12 sm:px-6">
      {page.status !== "published" ? (
        <p className="mb-8 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning">Draft preview. Visitors can&apos;t see this page yet.</p>
      ) : null}
      <h1 className="text-4xl font-bold tracking-tight">{page.title}</h1>
      <p className="mt-2 flex flex-wrap gap-x-3 text-sm text-muted">
        <span>Last updated {formatDate(page.updatedAt, { year: true })}</span>
        {canEdit ? (
          <Link href={`/admin/pages/${page.id}`} className="text-accent hover:underline">
            Edit page
          </Link>
        ) : null}
      </p>
      <article className="prose-story mt-10" dangerouslySetInnerHTML={{ __html: html }} />
      <p className="mt-16 text-sm text-muted">
        <Link href="/" className="hover:text-fg">← Back to {settings.siteName}</Link>
      </p>
    </main>
  );
}
