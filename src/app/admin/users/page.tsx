import Link from "next/link";
import { AdminHeader, AdminTable } from "@/components/admin/page-header";
import { UserAdminActions } from "@/components/admin/admin-actions";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { adminListUsers } from "@/lib/queries";
import { InviteForm, RevokeInviteButton } from "@/components/admin/user-forms";
import { db } from "@/db";
import { invites } from "@/db/schema";
import { desc, isNull } from "drizzle-orm";
import { requireCan } from "@/lib/session";
import { asRole, ROLE_INFO } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Users" };

export default async function AdminUsers({ searchParams }: PageProps<"/admin/users">) {
  const me = await requireCan("manageUsers", "/admin/users");
  const raw = (await searchParams).q;
  const q = typeof raw === "string" ? raw.trim() : "";
  const [users, pendingInvites] = await Promise.all([
    adminListUsers(q || undefined),
    db.select().from(invites).where(isNull(invites.usedAt)).orderBy(desc(invites.createdAt)),
  ]);
  return (
    <>
      <AdminHeader title="Users" description="Give people a role to let them write, edit or run the site. New sign-ups start as Subscribers.">
        <form action="/admin/users" className="w-full sm:w-64">
          <label htmlFor="user-q" className="sr-only">Search members</label>
          <Input id="user-q" name="q" defaultValue={q} placeholder="Search name or email" type="search" />
        </form>
      </AdminHeader>
      <div className="mb-8 flex flex-col gap-4">
        <InviteForm />
        {pendingInvites.length ? (
          <div className="rounded-md border border-line p-4">
            <h2 className="mb-2 text-sm font-semibold">Pending invitations</h2>
            <ul className="flex flex-col">
              {pendingInvites.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-3 border-b border-line py-2 text-sm last:border-0">
                  <span className="min-w-0 flex-1 truncate">{i.email}</span>
                  <Badge>{ROLE_INFO[asRole(i.role)].label}</Badge>
                  <span className="text-xs text-muted">
                    {i.expiresAt < new Date() ? "Expired" : `Expires ${formatDate(i.expiresAt)}`}
                  </span>
                  <RevokeInviteButton id={i.id} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
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
                    <Link href={`/admin/users/${u.id}`} className="block truncate font-medium hover:underline">
                      {u.name}
                    </Link>
                    <span className="block truncate text-xs text-muted">{u.email}</span>
                  </span>
                </span>
              </td>
              <td>
                <span className="flex flex-wrap gap-1">
                  <Badge tone={asRole(u.role) === "admin" ? "accent" : asRole(u.role) === "subscriber" ? "neutral" : "success"}>
                    {ROLE_INFO[asRole(u.role)].label}
                  </Badge>
                  {u.banned ? <Badge tone="danger">Suspended</Badge> : null}
                </span>
              </td>
              <td className="tabular-nums">{u.stories}</td>
              <td className="whitespace-nowrap text-muted">{formatDate(u.createdAt, { year: true })}</td>
              <td className="text-right">
                <UserAdminActions id={u.id} name={u.name} role={asRole(u.role)} banned={u.banned} isMe={u.id === me.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </AdminTable>
    </>
  );
}
