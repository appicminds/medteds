import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, ne, sql } from "drizzle-orm";
import { AdminHeader } from "@/components/admin/page-header";
import { DeleteUserForm, EditUserForm, ResetPasswordButton } from "@/components/admin/user-forms";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db";
import { posts, user } from "@/db/schema";
import { asRole } from "@/lib/permissions";
import { listWriters } from "@/lib/queries";
import { requireCan } from "@/lib/session";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Edit user" };

export default async function EditUserPage({ params }: PageProps<"/admin/users/[id]">) {
  const me = await requireCan("manageUsers", "/admin/users");
  const { id } = await params;
  const u = await db.query.user.findFirst({ where: eq(user.id, id) });
  if (!u) notFound();
  const [[{ n: storyCount }], writers] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(posts).where(and(eq(posts.authorId, id), ne(posts.status, "trash"))),
    listWriters(),
  ]);
  const isMe = u.id === me.id;

  return (
    <>
      <Link href="/admin/users" className="text-sm text-muted hover:text-fg">← All users</Link>
      <div className="mt-4">
        <AdminHeader title={u.name} description={u.email}>
          <span className="flex items-center gap-3">
            {u.banned ? <Badge tone="danger">Suspended</Badge> : null}
            <Avatar name={u.name} src={u.image} size="md" />
          </span>
        </AdminHeader>
      </div>
      <div className="grid max-w-3xl gap-8">
        <section className="rounded-md border border-line p-5">
          <h2 className="mb-4 font-semibold">Profile and role</h2>
          <EditUserForm u={{ id: u.id, name: u.name, username: u.username ?? "", bio: u.bio ?? "", role: asRole(u.role) }} isMe={isMe} />
          <p className="mt-4 text-xs text-muted">
            Joined {formatDate(u.createdAt, { year: true })} ·{" "}
            <Link href={`/@${u.username}`} className="hover:underline">View profile</Link>
          </p>
        </section>
        <section className="rounded-md border border-line p-5">
          <h2 className="mb-1 font-semibold">Password</h2>
          <p className="mb-4 text-sm text-muted">Create a one-time link the person can use to choose a new password.</p>
          <ResetPasswordButton id={u.id} />
        </section>
        {!isMe ? (
          <section className="rounded-md border border-danger/40 p-5">
            <h2 className="mb-3 font-semibold">Delete user</h2>
            <DeleteUserForm id={u.id} name={u.name} storyCount={storyCount} writers={writers.filter((w) => w.id !== u.id).map((w) => ({ id: w.id, name: w.name }))} />
          </section>
        ) : null}
      </div>
    </>
  );
}
