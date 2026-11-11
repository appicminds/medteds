import Link from "next/link";
import { desc } from "drizzle-orm";
import { AdminHeader, AdminTable } from "@/components/admin/page-header";
import { NewPageButton, DeletePageButton } from "@/components/admin/page-actions";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db";
import { pages } from "@/db/schema";
import { requireCan } from "@/lib/session";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Pages" };

export default async function AdminPages() {
  await requireCan("managePages", "/admin/pages");
  const list = await db.select().from(pages).orderBy(desc(pages.updatedAt));
  return (
    <>
      <AdminHeader title="Pages" description="Standalone pages like About, Privacy and Terms. Add them to a menu in Menus.">
        <NewPageButton />
      </AdminHeader>
      {list.length ? (
        <AdminTable>
          <thead>
            <tr>
              <th>Title</th>
              <th>Address</th>
              <th>Status</th>
              <th>Updated</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/admin/pages/${p.id}`} className="font-medium hover:underline">
                    {p.title || "Untitled page"}
                  </Link>
                </td>
                <td className="font-mono text-xs text-muted">/{p.slug}</td>
                <td>
                  <Badge tone={p.status === "published" ? "success" : "neutral"}>{p.status === "published" ? "Published" : "Draft"}</Badge>
                </td>
                <td className="whitespace-nowrap text-muted">{formatDate(p.updatedAt, { year: true })}</td>
                <td className="text-right">
                  <span className="flex justify-end gap-1">
                    <Link href={`/admin/pages/${p.id}`} className="rounded-pill px-3 py-1.5 text-sm text-muted hover:text-fg">Edit</Link>
                    <Link href={`/${p.slug}`} className="rounded-pill px-3 py-1.5 text-sm text-muted hover:text-fg">View</Link>
                    <DeletePageButton id={p.id} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </AdminTable>
      ) : (
        <p className="py-10 text-center text-muted">No pages yet.</p>
      )}
    </>
  );
}
