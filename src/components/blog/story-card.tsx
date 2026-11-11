import Link from "next/link";
import { MessageCircle, Sparkles } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Cover } from "@/components/ui/cover";
import { BookmarkButton } from "@/components/blog/bookmark-button";
import { ClapIcon } from "@/components/blog/clap-button";
import type { StoryCardData } from "@/lib/queries";
import { compactNumber, formatDate } from "@/lib/utils";

export function StoryCard({ story, saved, signedIn }: { story: StoryCardData; saved: boolean; signedIn: boolean }) {
  const topic = story.topics[0];
  return (
    <article className="flex gap-4 border-b border-line py-8 sm:gap-12">
      <div className="min-w-0 flex-1">
        <div className="mb-2.5 flex min-w-0 items-center gap-2 text-xs">
          <Avatar name={story.author.name} src={story.author.image} size="xs" />
          <Link href={`/@${story.author.username}`} className="truncate font-medium hover:underline">
            {story.author.name}
          </Link>
          {topic ? (
            <>
              <span className="text-muted">in</span>
              <Link href={`/tag/${topic.slug}`} className="truncate font-medium hover:underline">
                {topic.name}
              </Link>
            </>
          ) : null}
        </div>
        <Link href={`/p/${story.slug}`} className="block">
          <h2 className="text-base font-bold leading-snug tracking-tight sm:text-2xl">{story.title}</h2>
          {story.subtitle || story.excerpt ? (
            <p className="mt-1.5 hidden font-serif text-base leading-6 text-muted sm:line-clamp-2">{story.subtitle || story.excerpt}</p>
          ) : null}
        </Link>
        <div className="mt-4 flex items-center gap-3 text-xs text-muted sm:gap-4">
          {story.featured ? (
            <span title="Editor's pick" className="text-accent">
              <Sparkles size={14} aria-label="Editor's pick" />
            </span>
          ) : null}
          <span className="whitespace-nowrap">{formatDate(story.publishedAt)}</span>
          <span className="whitespace-nowrap">{story.readingMinutes} min read</span>
          <span className="inline-flex items-center gap-1 tabular-nums" title="Claps">
            <ClapIcon size={16} /> {compactNumber(story.clapCount)}
          </span>
          <span className="inline-flex items-center gap-1 tabular-nums" title="Responses">
            <MessageCircle size={15} strokeWidth={1.6} /> {story.commentCount}
          </span>
          <span className="flex-1" />
          <BookmarkButton postId={story.id} saved={saved} signedIn={signedIn} />
        </div>
      </div>
      <Link href={`/p/${story.slug}`} tabIndex={-1} aria-hidden className="shrink-0">
        <Cover src={story.coverImage} seed={story.id} className="h-[54px] w-20 rounded-sm sm:h-[107px] sm:w-40" />
      </Link>
    </article>
  );
}

export function StoryList({ stories, savedIds, signedIn }: { stories: StoryCardData[]; savedIds: Set<string>; signedIn: boolean }) {
  return (
    <div>
      {stories.map((s) => (
        <StoryCard key={s.id} story={s} saved={savedIds.has(s.id)} signedIn={signedIn} />
      ))}
    </div>
  );
}
