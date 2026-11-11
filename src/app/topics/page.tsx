import Link from "next/link";
import { listTopics } from "@/lib/queries";
import { alternatesFor } from "@/lib/seo";

export const metadata = { title: "All topics", alternates: alternatesFor("/topics") };

export default async function TopicsPage() {
  const topics = await listTopics();
  return (
    <main className="mx-auto max-w-feed px-4 pb-16 pt-12 sm:px-6">
      <h1 className="text-4xl font-bold tracking-tight">Explore topics</h1>
      <p className="mt-3 text-muted">Every area of medicine and health that MedTeds writers cover.</p>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {topics.map((t) => (
          <li key={t.id}>
            <Link href={`/tag/${t.slug}`} className="flex h-full flex-col gap-1 rounded-md border border-line p-5 transition-colors hover:border-fg">
              <span className="font-semibold">{t.name}</span>
              {t.description ? <span className="text-sm text-muted">{t.description}</span> : null}
              <span className="mt-auto pt-2 text-xs text-muted">
                {t.storyCount} {t.storyCount === 1 ? "story" : "stories"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
