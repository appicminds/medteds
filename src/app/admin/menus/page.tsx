import { eq } from "drizzle-orm";
import { AdminHeader } from "@/components/admin/page-header";
import { MenuEditor } from "@/components/admin/menu-editor";
import { db } from "@/db";
import { pages } from "@/db/schema";
import { listTopics } from "@/lib/queries";
import { requireCan } from "@/lib/session";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Menus" };

export default async function AdminMenus() {
  await requireCan("manageMenus", "/admin/menus");
  const [settings, pageList, topics] = await Promise.all([
    getSettings(),
    db.select({ title: pages.title, slug: pages.slug }).from(pages).where(eq(pages.status, "published")),
    listTopics(),
  ]);
  const suggestions = [
    { label: "Home", url: "/" },
    { label: "Topics", url: "/topics" },
    ...pageList.map((p) => ({ label: p.title, url: `/${p.slug}` })),
    ...topics.map((t) => ({ label: t.name, url: `/tag/${t.slug}` })),
  ];
  return (
    <>
      <AdminHeader title="Menus" description="Links shown in the bar under the header and in the site footer." />
      <MenuEditor header={settings.headerMenu} footer={settings.footerMenu} suggestions={suggestions} />
    </>
  );
}
