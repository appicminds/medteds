import Link from "next/link";
import { requireCan } from "@/lib/session";
import { AdminHeader, AdminTable } from "@/components/admin/page-header";
import { TopicDeleteButton } from "@/components/admin/admin-actions";
import { TopicForm } from "@/components/admin/topic-form";
import { listTopics } from "@/lib/queries";

export const metadata = { title: "Topics" };

export default async function AdminTopics({ searchParams }: PageProps<"/admin/topics">) {
  await requireCan("manageTopics", "/admin");
  const editId = Number((await searchParams).edit) || null;
  const topics = await listTopics();
  const editing = editId ? topics.find((t) => t.id === editId) : undefined;
  return (
    <>
      <AdminHeader title="Topics" description="Topics organise stories. Writers pick up to five per story." />
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <AdminTable>
          <thead>
            <tr>
              <th>Topic</th>
              <th>Stories</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {topics.map((t) => (
              <tr key={t.id}>
                <td>
                  <Link href={`/tag/${t.slug}`} className="font-medium hover:underline">
                    {t.name}
                  </Link>
                  {t.description ? <p className="line-clamp-1 text-xs text-muted">{t.description}</p> : null}
                </td>
                <td className="tabular-nums">{t.storyCount}</td>
                <td className="text-right">
                  <span className="flex justify-end gap-1">
                    <Link href={`/admin/topics?edit=${t.id}`} className="rounded-pill px-3 py-1.5 text-sm text-muted hover:text-fg">
                      Edit
                    </Link>
                    <TopicDeleteButton id={t.id} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </AdminTable>
        <div className="self-start rounded-md border border-line p-5">
          <h2 className="mb-4 font-semibold">{editing ? `Edit “${editing.name}”` : "Add a topic"}</h2>
          <TopicForm key={editing?.id ?? "new"} topic={editing ? { id: editing.id, name: editing.name, description: editing.description ?? "" } : undefined} />
        </div>
      </div>
    </>
  );
}
