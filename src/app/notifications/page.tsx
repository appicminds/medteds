import Link from "next/link";
import { Bell } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkTabs } from "@/components/ui/tabs";
import { listNotifications, markAllRead, type NotificationItem } from "@/lib/notifications";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Notifications", robots: { index: false, follow: false } };

function dayLabel(d: Date) {
  const today = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(today) - start(d)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return d.toLocaleDateString("en-US", { weekday: "long" });
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

/** "Just now", "5 min ago", "3 h ago"; older items only show their day heading. */
function timeLabel(d: Date) {
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours} h ago` : "";
}

function Message({ n }: { n: NotificationItem }) {
  const who = n.actor ? (
    <Link href={`/@${n.actor.username}`} className="font-medium hover:underline">
      {n.actor.name}
    </Link>
  ) : (
    <span className="font-medium">Someone</span>
  );
  const story = n.post ? (
    <Link href={`/p/${n.post.slug}`} className="font-medium hover:underline">
      {n.post.title}
    </Link>
  ) : null;
  switch (n.type) {
    case "clap":
      return <>{who} clapped {n.count > 1 ? `${n.count} times ` : ""}for {story}</>;
    case "response":
      return <>{who} responded to {story}</>;
    case "reply":
      return <>{who} replied to your response on {story}</>;
    case "follow":
      return <>{who} started following you</>;
    case "new_story":
      return <>{who} published {story}</>;
    case "published":
      return <>Your story {story} was published by {who}</>;
    default:
      return <>{who}</>;
  }
}

export default async function NotificationsPage({ searchParams }: PageProps<"/notifications">) {
  const me = await requireUser("/notifications");
  const tab = (await searchParams).tab === "responses" ? "responses" : "all";
  const items = await listNotifications(me.id, tab);
  // Opening the page marks everything as read; this visit still shows which ones were new.
  await markAllRead(me.id);

  const groups: { label: string; items: NotificationItem[] }[] = [];
  for (const n of items) {
    const label = dayLabel(n.createdAt);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(n);
    else groups.push({ label, items: [n] });
  }

  return (
    <main className="mx-auto max-w-feed px-4 pb-24 pt-12 sm:px-6">
      <h1 className="text-4xl font-bold tracking-tight">Notifications</h1>
      <LinkTabs
        className="mb-6 mt-8"
        active={tab}
        items={[
          { key: "all", label: "All", href: "/notifications" },
          { key: "responses", label: "Responses", href: "/notifications?tab=responses" },
        ]}
      />
      {groups.length ? (
        <div className="flex flex-col gap-8">
          {groups.map((g) => (
            <section key={g.label}>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted">{g.label}</h2>
              <ul className="divide-y divide-line">
                {g.items.map((n) => (
                  <li key={n.id} className="flex gap-3 py-4">
                    {n.actor ? (
                      <Link href={`/@${n.actor.username}`} className="shrink-0">
                        <Avatar name={n.actor.name} src={n.actor.image} size="sm" />
                      </Link>
                    ) : (
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface text-muted">
                        <Bell size={16} />
                      </span>
                    )}
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="leading-5">
                        <Message n={n} />
                      </p>
                      {n.commentBody ? <p className="mt-1 line-clamp-2 text-muted">&ldquo;{n.commentBody}&rdquo;</p> : null}
                      {timeLabel(n.createdAt) ? <p className="mt-1 text-xs text-muted">{timeLabel(n.createdAt)}</p> : null}
                    </div>
                    {!n.read ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="New" /> : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <div className="py-12">
          <EmptyState title={tab === "responses" ? "No responses yet" : "You're all caught up"}>
            {tab === "responses"
              ? "When readers respond to your stories, you'll see it here."
              : "Claps, responses, new followers and new stories from writers you follow will show up here."}
          </EmptyState>
        </div>
      )}
    </main>
  );
}
