import { notFound, redirect } from "next/navigation";
import type { JSONContent } from "@tiptap/core";
import { StoryEditor } from "@/components/cms/story-editor";
import { can, canEditPost } from "@/lib/permissions";
import { getEditableStory, listRevisions, listTopics, listWriters } from "@/lib/queries";
import { requireCan } from "@/lib/session";

export const metadata = { title: "Editing story" };

export default async function EditorPage({ params }: PageProps<"/editor/[id]">) {
  const { id } = await params;
  const me = await requireCan("write", `/editor/${id}`);
  const story = await getEditableStory(id);
  if (!story) notFound();
  if (!canEditPost(me, story)) redirect(`/p/${story.slug}`);
  if (story.status === "trash") redirect("/me/stories?tab=trash");
  const isEditor = can(me, "editOthersPosts");
  const [topics, revisions, writers] = await Promise.all([listTopics(), listRevisions(id), isEditor ? listWriters() : Promise.resolve([])]);

  return (
    <StoryEditor
      story={{
        id: story.id,
        slug: story.slug,
        title: story.title,
        subtitle: story.subtitle,
        content: story.content as JSONContent | null,
        coverImage: story.coverImage,
        status: story.status,
        topicIds: story.topics.map((t) => t.id),
        seoTitle: story.seoTitle,
        seoDescription: story.seoDescription,
        authorId: story.authorId,
        featured: story.featured,
        publishedAt: story.publishedAt?.toISOString() ?? null,
      }}
      topics={topics.map((t) => ({ id: t.id, name: t.name }))}
      writers={writers.map((w) => ({ id: w.id, name: w.name }))}
      revisions={revisions.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
      perms={{ canPublish: can(me, "publish"), isEditor }}
      siteUrl={process.env.NEXT_PUBLIC_APP_URL ?? "https://medteds.vercel.app"}
    />
  );
}
