import { AdminNav, type AdminNavKey } from "@/components/admin/admin-nav";
import { can } from "@/lib/permissions";
import { requireCan } from "@/lib/session";

export const metadata = { title: { default: "Admin", template: "%s · Admin · MedTeds" } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const me = await requireCan("viewAdmin", "/admin");
  const items: AdminNavKey[] = ["dashboard", "posts"];
  if (can(me, "manageMedia")) items.push("media");
  if (can(me, "managePages")) items.push("pages");
  if (can(me, "manageSeo")) items.push("seo");
  if (can(me, "moderateComments")) items.push("comments");
  if (can(me, "manageTopics")) items.push("topics");
  if (can(me, "manageUsers")) items.push("users");
  if (can(me, "manageMenus")) items.push("menus");
  if (can(me, "manageSettings")) items.push("settings");
  return (
    <div className="mx-auto grid max-w-page grid-cols-1 gap-8 px-4 pb-16 pt-8 sm:px-6 md:grid-cols-[200px_minmax(0,1fr)] md:pt-12">
      <AdminNav items={items} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
