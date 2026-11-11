import { notFound } from "next/navigation";
import type { JSONContent } from "@tiptap/core";
import { StoryEditor } from "@/components/cms/story-editor";
import { getEditableStory, listTopics } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Editing story" };

export default async function EditorPage({ params }: PageProps<"/editor/[id]">) {
  const { id } = await params;
  const me = await requireUser(`/editor/${id}`);
  const [story, topics] = await Promise.all([getEditableStory(id, me.id, me.role === "admin"), listTopics()]);
  if (!story) notFound();
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
      }}
      topics={topics.map((t) => ({ id: t.id, name: t.name }))}
    />
  );
}
