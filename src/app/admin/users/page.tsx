import Link from "next/link";
import { AdminHeader, AdminTable } from "@/components/admin/page-header";
import { UserAdminActions } from "@/components/admin/admin-actions";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { adminListUsers } from "@/lib/queries";
import { requireAdmin } from "@/lib/session";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Members" };

export default async function AdminUsers({ searchParams }: PageProps<"/admin/users">) {
  const me = await requireAdmin();
  const raw = (await searchParams).q;
  const q = typeof raw === "string" ? raw.trim() : "";
  const users = await adminListUsers(q || undefined);
  return (
    <>
      <AdminHeader title="Members" description="Manage admin access and suspend accounts that break the rules.">
        <form action="/admin/users" className="w-full sm:w-64">
          <label htmlFor="user-q" className="sr-only">Search members</label>
          <Input id="user-q" name="q" defaultValue={q} placeholder="Search name or email" type="search" />
        </form>
      </AdminHeader>
      <AdminTable>
        <thead>
          <tr>
            <th>Member</th>
            <th>Role</th>
            <th>Stories</th>
            <th>Joined</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                <span className="flex items-center gap-3">
                  <Avatar name={u.name} src={u.image} size="sm" />
                  <span className="min-w-0">
                    <Link href={`/@${u.username}`} className="block truncate font-medium hover:underline">
                      {u.name}
                    </Link>
                    <span className="block truncate text-xs text-muted">{u.email}</span>
                  </span>
                </span>
              </td>
              <td>
                <span className="flex flex-wrap gap-1">
                  <Badge tone={u.role === "admin" ? "accent" : "neutral"}>{u.role === "admin" ? "Admin" : "Member"}</Badge>
                  {u.banned ? <Badge tone="danger">Suspended</Badge> : null}
                </span>
              </td>
              <td className="tabular-nums">{u.stories}</td>
              <td className="whitespace-nowrap text-muted">{formatDate(u.createdAt, { year: true })}</td>
              <td className="text-right">
                <UserAdminActions id={u.id} role={u.role} banned={u.banned} isMe={u.id === me.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </AdminTable>
    </>
  );
}
