import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle, Pencil } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Cover } from "@/components/ui/cover";
import { BookmarkButton } from "@/components/blog/bookmark-button";
import { ClapButton } from "@/components/blog/clap-button";
import { Comments } from "@/components/blog/comments";
import { FollowButton } from "@/components/blog/follow-button";
import { ShareButton } from "@/components/blog/share-button";
import { ViewTracker } from "@/components/blog/view-tracker";
import { StoryBody } from "@/components/blog/highlighter";
import { renderStoryHtml } from "@/lib/content";
import { getStory, listStories, storyHighlights } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { compactNumber, formatDate } from "@/lib/utils";
import { canEditPost } from "@/lib/permissions";
import { isLive } from "@/lib/live";
import { absoluteUrl, alternatesFor, jsonLd, robotsFor, twitterCard } from "@/lib/seo";
import { effectiveSeo } from "@/lib/seo-auto";
import { getSettings } from "@/lib/settings";
import type { JSONContent } from "@tiptap/core";

export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const [story, settings] = await Promise.all([getStory(slug), getSettings()]);
  if (!story || !isLive(story)) return { title: "Story not found", robots: { index: false, follow: false } };
  const seo = effectiveSeo(story, settings.defaultShareImage);
  const title = seo.title;
  const description = seo.description || undefined;
  const authorUrl = absoluteUrl(`/@${story.author.username}`);
  return {
    title: { absolute: seo.customTitle ? seo.title : `${seo.autoTitle} ${settings.titleSeparator} ${settings.siteName}` },
    description,
    authors: [{ name: story.author.name, url: authorUrl }],
    keywords: story.topics.map((t) => t.name),
    alternates: alternatesFor(`/p/${story.slug}`, story.canonicalUrl),
    robots: robotsFor(settings, story.noindex),
    openGraph: {
      siteName: settings.siteName,
      title,
      description,
      type: "article",
      url: `/p/${story.slug}`,
      publishedTime: story.publishedAt?.toISOString(),
      modifiedTime: story.updatedAt.toISOString(),
      authors: [authorUrl],
      tags: story.topics.map((t) => t.name),
      images: seo.image ? [seo.image] : undefined,
    },
    twitter: twitterCard(settings, { title, description, image: seo.image }),
  };
}

export default async function StoryPage({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const me = await getCurrentUser();
  const [story, settings] = await Promise.all([getStory(slug, me?.id), getSettings()]);
  if (!story || story.authorBanned) notFound();

  const isAuthor = me?.id === story.author.id;
  const canEdit = canEditPost(me, { authorId: story.author.id, status: story.status });
  const live = isLive(story);
  if (!live && !canEdit) notFound();

  const html = await renderStoryHtml(story.content as JSONContent);
  const more = (await listStories({ authorId: story.author.id, limit: 4 })).filter((s) => s.id !== story.id).slice(0, 3);

  const seo = effectiveSeo(story, settings.defaultShareImage);
  const image = seo.image;
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: seo.title.slice(0, 110),
    description: seo.description || undefined,
    image: image ? [absoluteUrl(image)] : undefined,
    datePublished: story.publishedAt?.toISOString(),
    dateModified: story.updatedAt.toISOString(),
    author: { "@type": "Person", name: story.author.name, url: absoluteUrl(`/@${story.author.username}`) },
    publisher: {
      "@type": "Organization",
      name: settings.siteName,
      logo: settings.logoUrl ? { "@type": "ImageObject", url: absoluteUrl(settings.logoUrl) } : undefined,
    },
    mainEntityOfPage: story.canonicalUrl || absoluteUrl(`/p/${story.slug}`),
    keywords: story.topics.map((t) => t.name).join(", ") || undefined,
  };

  return (
    <main className="mx-auto max-w-[728px] px-4 pb-24 pt-10 sm:px-6 sm:pt-12">
      {live ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(articleLd) }} /> : null}
      {live && !isAuthor ? <ViewTracker postId={story.id} /> : null}
      {!live ? (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning">
          <span>
            {story.status === "scheduled"
              ? "Preview of a scheduled story. Readers can't see it yet."
              : story.status === "pending"
                ? "Preview of a story waiting for review. Readers can't see it yet."
                : "This is a draft preview. Readers can't see it."}
          </span>
          <ButtonLink href={`/editor/${story.id}`} variant="outline" size="sm">
            Continue editing
          </ButtonLink>
        </div>
      ) : null}

      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{story.title || "Untitled story"}</h1>
      {story.subtitle ? <p className="mt-3 text-lg text-muted sm:text-2xl sm:leading-[1.9rem]">{story.subtitle}</p> : null}

      <div className="my-8 flex items-center gap-3">
        <Link href={`/@${story.author.username}`}>
          <Avatar name={story.author.name} src={story.author.image} size="md" />
        </Link>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2">
            <Link href={`/@${story.author.username}`} className="font-medium hover:underline">
              {story.author.name}
            </Link>
            {!isAuthor ? (
              <>
                <span aria-hidden className="text-muted">·</span>
                <FollowButton userId={story.author.id} following={story.viewer.following} signedIn={!!me} variant="link" />
              </>
            ) : null}
          </div>
          <p className="text-sm text-muted">
            {story.readingMinutes} min read
            {story.publishedAt ? <> · {formatDate(story.publishedAt, { year: true })}</> : null}
            {story.topics[0] ? (
              <>
                {" "}· in{" "}
                <Link href={`/tag/${story.topics[0].slug}`} className="hover:underline">
                  {story.topics[0].name}
                </Link>
              </>
            ) : null}
          </p>
        </div>
      </div>

      <StoryActions story={story} me={me} isAuthor={isAuthor} canEdit={canEdit} />

      {story.coverImage && !html.includes(story.coverImage) ? (
        <Cover src={story.coverImage} seed={story.id} className="mb-10 aspect-video w-full max-w-full rounded-sm" />
      ) : null}

      <StoryBody html={html} postId={story.id} highlights={live ? await storyHighlights(story.id, me?.id) : []} signedIn={!!me} />

      {story.topics.length ? (
        <div className="mt-12 flex flex-wrap gap-2">
          {story.topics.map((t) => (
            <Chip key={t.slug} href={`/tag/${t.slug}`}>
              {t.name}
            </Chip>
          ))}
        </div>
      ) : null}

      <div className="mt-8">
        <StoryActions story={story} me={me} isAuthor={isAuthor} canEdit={canEdit} compact />
      </div>

      <section className="-mx-4 mt-12 rounded-md bg-surface px-4 py-10 sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-start gap-4">
          <Link href={`/@${story.author.username}`}>
            <Avatar name={story.author.name} src={story.author.image} size="lg" />
          </Link>
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold">
              Written by <Link href={`/@${story.author.username}`} className="hover:underline">{story.author.name}</Link>
            </h2>
            <p className="mt-1 text-sm text-muted">{compactNumber(story.authorFollowers)} followers</p>
            {story.authorBio ? <p className="mt-3 text-sm leading-5">{story.authorBio}</p> : null}
          </div>
          {!isAuthor ? (
            <FollowButton userId={story.author.id} following={story.viewer.following} signedIn={!!me} />
          ) : null}
        </div>
        {more.length ? (
          <div className="mt-10 border-t border-line pt-8">
            <h3 className="mb-6 font-semibold">More from {story.author.name}</h3>
            <div className="grid gap-6 sm:grid-cols-3">
              {more.map((m) => (
                <Link key={m.id} href={`/p/${m.slug}`} className="group flex flex-col gap-3">
                  <Cover src={m.coverImage} seed={m.id} className="aspect-[16/10] w-full max-w-full rounded-sm" />
                  <span className="font-bold leading-5 group-hover:underline">{m.title}</span>
                  <span className="text-xs text-muted">
                    {m.readingMinutes} min read · {formatDate(m.publishedAt)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {live ? (
        <div className="mt-12">
          <Comments postId={story.id} postAuthorId={story.author.id} me={me} />
        </div>
      ) : null}
    </main>
  );
}

function StoryActions({
  story,
  me,
  isAuthor,
  canEdit,
  compact,
}: {
  story: NonNullable<Awaited<ReturnType<typeof getStory>>>;
  me: Awaited<ReturnType<typeof getCurrentUser>>;
  isAuthor: boolean;
  canEdit: boolean;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "flex items-center gap-6 px-1" : "mb-10 flex items-center gap-6 border-y border-line px-2 py-2.5"}>
      <ClapButton postId={story.id} total={story.clapCount} mine={story.viewer.claps} signedIn={!!me} isAuthor={isAuthor} />
      <a href="#responses" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg" aria-label="Responses">
        <MessageCircle size={21} strokeWidth={1.6} /> <span className="tabular-nums">{story.commentCount}</span>
      </a>
      <span className="flex-1" />
      {story.featured && !compact ? <span className="whitespace-nowrap"><Badge tone="accent">Editor&apos;s pick</Badge></span> : null}
      {canEdit && !compact ? (
        <Link href={`/editor/${story.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
          <Pencil size={18} strokeWidth={1.6} /> Edit
        </Link>
      ) : null}
      <BookmarkButton postId={story.id} saved={story.viewer.bookmarked} signedIn={!!me} size={22} />
      <ShareButton title={story.title} />
    </div>
  );
}
