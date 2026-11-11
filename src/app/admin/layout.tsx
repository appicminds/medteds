import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: { default: "Admin", template: "%s · Admin · MedTeds" } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return (
    <div className="mx-auto grid max-w-page grid-cols-1 gap-8 px-4 pb-16 pt-8 sm:px-6 md:grid-cols-[200px_minmax(0,1fr)] md:pt-12">
      <AdminNav />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
