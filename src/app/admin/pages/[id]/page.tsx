import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import type { JSONContent } from "@tiptap/core";
import { PageEditor } from "@/components/cms/page-editor";
import { db } from "@/db";
import { pages } from "@/db/schema";
import { requireCan } from "@/lib/session";
import { siteOrigin } from "@/lib/seo";

export const metadata = { title: "Edit page" };

export default async function EditPage({ params }: PageProps<"/admin/pages/[id]">) {
  await requireCan("managePages", "/admin/pages");
  const { id } = await params;
  const page = await db.query.pages.findFirst({ where: eq(pages.id, id) });
  if (!page) notFound();
  return (
    <PageEditor
      page={{
        id: page.id,
        title: page.title,
        slug: page.slug.startsWith("untitled-") ? "" : page.slug,
        content: page.content as JSONContent | null,
        status: page.status as "draft" | "published",
        seoTitle: page.seoTitle ?? "",
        seoDescription: page.seoDescription ?? "",
        noindex: page.noindex,
      }}
      siteUrl={siteOrigin()}
    />
  );
}
