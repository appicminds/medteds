import { InterestPicker } from "@/components/blog/interest-picker";
import { followedTopics, listTopics } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Pick your interests", robots: { index: false, follow: false } };

function safeNext(v: unknown) {
  return typeof v === "string" && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/welcome") ? v : "/";
}

export default async function WelcomeTopics({ searchParams }: PageProps<"/welcome/topics">) {
  const next = safeNext((await searchParams).next);
  const me = await requireUser(`/welcome/topics`);
  const [topics, mine] = await Promise.all([listTopics(), followedTopics(me.id)]);
  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-14 text-center sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">What are you interested in?</h1>
      <p className="mt-3 text-muted">Pick at least 3 topics. We&apos;ll use them to shape your feed. You can change them any time.</p>
      <div className="mt-10">
        {topics.length ? (
          <InterestPicker topics={topics.map((t) => ({ id: t.id, name: t.name }))} initial={mine.map((t) => t.id)} next={next} />
        ) : (
          <p className="text-muted">There are no topics yet.</p>
        )}
      </div>
    </main>
  );
}
