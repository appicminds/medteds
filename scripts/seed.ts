/**
 * Fills an empty database with sample topics, writers and stories.
 * Run with: npm run db:seed
 * Sample accounts all use the password "medteds-demo".
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import type { JSONContent } from "@tiptap/core";
import { db } from "../src/db";
import { claps, comments, follows, postTopics, posts, topics, user } from "../src/db/schema";
import { auth } from "../src/lib/auth";
import { makeExcerpt, readingMinutes, storyText } from "../src/lib/content";
import { slugify } from "../src/lib/usernames";
import { newId } from "../src/lib/utils";

const PASSWORD = "medteds-demo";

const TOPICS = [
  ["Cardiology", "The heart, its rhythms, and the people who look after it."],
  ["Neuroscience", "Brains, nerves, sleep and the science of the mind."],
  ["Public Health", "Prevention, policy and the health of whole populations."],
  ["Med School", "Life as a medical student, from first lecture to first night shift."],
  ["Medical AI", "Algorithms in the clinic: what works, what doesn't, and what's next."],
  ["Mental Health", "Psychiatry, psychology and caring for the carers."],
  ["Nutrition", "Food, metabolism and the evidence behind the advice."],
  ["Oncology", "Cancer research, treatment and survivorship."],
] as const;

const WRITERS = [
  { name: "Dr. Amara Reyes", email: "amara@medteds.local", bio: "Cardiologist. Writing about the human side of heart medicine." },
  { name: "Jonah Kim", email: "jonah@medteds.local", bio: "Neuroscientist studying sleep and memory." },
  { name: "Priya Nair", email: "priya@medteds.local", bio: "Public health researcher. Clean water, clean data." },
  { name: "Tomás Ortega", email: "tomas@medteds.local", bio: "Third-year medical student keeping notes." },
  { name: "Dr. Lena Weiss", email: "lena@medteds.local", bio: "Radiologist working on clinical AI." },
];

const p = (text: string): JSONContent => ({ type: "paragraph", content: [{ type: "text", text }] });
const h2 = (text: string): JSONContent => ({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text }] });
const quote = (text: string): JSONContent => ({ type: "blockquote", content: [p(text)] });
const list = (items: string[]): JSONContent => ({
  type: "bulletList",
  content: items.map((t) => ({ type: "listItem", content: [p(t)] })),
});
const doc = (...content: JSONContent[]): JSONContent => ({ type: "doc", content });

const STORIES: {
  author: number;
  title: string;
  subtitle: string;
  topics: string[];
  featured?: boolean;
  daysAgo: number;
  body: JSONContent;
}[] = [
  {
    author: 0,
    title: "What 10,000 ECGs Taught Me About Listening",
    subtitle: "The most important diagnostic tool in the clinic isn't the machine. It's the five minutes before you order the test.",
    topics: ["Cardiology"],
    featured: true,
    daysAgo: 7,
    body: doc(
      p("In my first year as a cardiology fellow, I believed the twelve-lead tracing would tell me everything. The waveform was objective. The patient's story was noise I had to sit through before getting to the signal."),
      p("Ten thousand tracings later, I've come to think almost exactly the opposite."),
      h2("The test answers the question you asked"),
      p("An ECG is a remarkably honest instrument. It shows you the electrical activity of the heart during a ten-second window, and nothing more. If the arrhythmia happens at 3 a.m. while climbing stairs, the tracing taken at 2 p.m. in a quiet room will be normal, and normal can be the most dangerous word in medicine."),
      quote("A normal result is only reassuring if you asked the right question."),
      p("The patient who mentions, almost in passing, that she gets lightheaded only when she carries laundry upstairs has given you more diagnostic information than the machine will. The question is whether you were listening when she said it."),
      h2("Five minutes, three questions"),
      p("These days, before I look at any tracing, I ask three things:"),
      list(["When does it happen?", "What were you doing at the time?", "What made it stop?"]),
      p("The answers shape which test I order, how long I monitor, and what I'm looking for when the results come back. None of this is new. Every attending I trained under said some version of it. But it took a few thousand tracings, and a few humbling misses, before I really believed it."),
    ),
  },
  {
    author: 1,
    title: "Sleep Is Not Rest: The Brain's Night Shift Explained",
    subtitle: "Your glymphatic system works hardest while you're unconscious. Here's what the newest research says.",
    topics: ["Neuroscience"],
    daysAgo: 9,
    body: doc(
      p("We talk about sleep as if the brain switches off. In reality, some of its most important maintenance happens only when we're unconscious."),
      h2("Washing the brain"),
      p("During deep sleep, the space between brain cells appears to widen, letting cerebrospinal fluid flow through and carry away metabolic waste. Researchers call this the glymphatic system, and it's one reason a single bad night leaves you foggy."),
      p("Among the waste products cleared are proteins linked to neurodegenerative disease. That doesn't mean poor sleep causes dementia, but it's a strong reason to treat sleep as part of brain health rather than a luxury."),
      h2("Memory gets filed overnight"),
      p("Sleep also replays the day. Patterns of activity recorded while learning a task reappear during sleep, strengthening some connections and pruning others. Students who sleep after studying consistently remember more than those who stay up."),
      quote("Pulling an all-nighter before an exam trades tomorrow's memory for tonight's hours."),
    ),
  },
  {
    author: 2,
    title: "The Quiet Success of Clean Water Programs",
    subtitle: "No headlines, no breakthroughs: just a decade of fewer funerals. Why prevention is the hardest story to tell.",
    topics: ["Public Health"],
    featured: true,
    daysAgo: 14,
    body: doc(
      p("The most effective health intervention I've worked on never made the news. Nobody was cured on camera. A district simply stopped losing as many children to diarrhoeal disease."),
      h2("Success looks like nothing happening"),
      p("Prevention has a storytelling problem. A new drug has a patient who got better. A water program has thousands of people who never got sick in the first place, and you can't interview someone about an illness they didn't have."),
      p("So funding drifts toward treatment, which is visible, and away from prevention, which is not. Our job as public health workers is partly to make the invisible countable."),
      h2("What actually worked"),
      list([
        "Chlorination at the household level, with refills delivered by trusted local volunteers.",
        "Hand-washing stations placed where people already gather, not where planners assumed they would.",
        "Monthly data shared back with the communities themselves, not just with funders.",
      ]),
      p("None of it was clever. All of it was consistent. Ten years on, consistency is the part I'd fight hardest to protect."),
    ),
  },
  {
    author: 3,
    title: "Year Three: Notes From the Night Before My First Surgery Rotation",
    subtitle: "Everything I wish someone had told me about scrubbing in and being the least useful person in the room.",
    topics: ["Med School"],
    daysAgo: 16,
    body: doc(
      p("Tomorrow at 6 a.m. I scrub in for the first time. I have watched the hand-washing video four times tonight. I am not sure that is helping."),
      h2("What the residents told me"),
      list([
        "Eat breakfast, even if you're nervous. Fainting is more common than you think.",
        "Don't touch anything blue. If you aren't sure, don't touch it.",
        "Learn the patient's story before the case. You'll be asked.",
        "Say 'I don't know, but I'll find out.' Every time.",
      ]),
      p("The last one is the hardest. Med school trains you to always have an answer. Surgery, apparently, trains you to be honest about not having one."),
      quote("Nobody expects you to be useful. They expect you to be safe, curious and on time."),
      p("I'll write again after the first week. Assuming I'm still standing."),
    ),
  },
  {
    author: 4,
    title: "AI Won't Replace Radiologists. It Will Change What They Look At.",
    subtitle: "A practising radiologist on triage algorithms, false reassurance, and the new skill of disagreeing with a machine.",
    topics: ["Medical AI", "Oncology"],
    featured: true,
    daysAgo: 20,
    body: doc(
      p("Our department has used an AI triage tool for chest X-rays for eighteen months. It reorders the worklist so scans it flags as urgent reach a radiologist first."),
      h2("Where it helps"),
      p("For collapsed lungs and large effusions, it's genuinely good. Urgent scans that might have waited an hour now get read in minutes. That matters for patients."),
      h2("Where it worries me"),
      p("The harder problem is the scans it marks as normal. A quiet worklist feels safe, and people read faster when they feel safe. The algorithm's confidence can become the reader's confidence without anyone deciding that it should."),
      quote("The new skill isn't reading images. It's knowing when to disagree with something that's usually right."),
      p("We now audit a random sample of AI-normal studies every week. It's slow and unglamorous. It's also the only way I know to keep our own judgement sharp."),
    ),
  },
  {
    author: 0,
    title: "The Stairs Test: Why I Ask Patients About Their Commute",
    subtitle: "How everyday activity reveals more about heart health than a resting exam.",
    topics: ["Cardiology"],
    daysAgo: 24,
    body: doc(
      p("I've started asking every new patient the same odd question: how do you get to work, and has that changed in the past year?"),
      p("People who used to walk from the station and now take the bus often have a reason, and they rarely volunteer it. Breathlessness creeps in slowly, and we adapt our lives around it without noticing."),
      h2("Function tells a story"),
      p("Exercise capacity is one of the strongest predictors of cardiovascular outcomes we have. You don't need a treadmill to begin estimating it. You need curiosity about how someone actually lives."),
      p("It's a small question. It has changed more of my diagnoses than I'd like to admit."),
    ),
  },
  {
    author: 1,
    title: "Caffeine, Adenosine and the 2 p.m. Slump",
    subtitle: "What your afternoon coffee is really doing to your brain.",
    topics: ["Neuroscience", "Nutrition"],
    daysAgo: 30,
    body: doc(
      p("Throughout the day, a molecule called adenosine builds up in the brain. The more of it there is, the sleepier you feel. Caffeine works by blocking adenosine receptors, hiding the tiredness without removing it."),
      h2("The borrowed energy"),
      p("When the caffeine wears off, the adenosine is still there, and often more of it. That's the crash. It also explains why an afternoon coffee can push your bedtime later than you expect: caffeine's half-life is around five hours."),
      p("None of this means giving up coffee. It means timing it. Morning coffee works with your body's rhythm. A 4 p.m. espresso works against it."),
    ),
  },
  {
    author: 2,
    title: "Vaccination Data Is Only as Good as the Clinic Clipboard",
    subtitle: "Why the hardest part of public health statistics happens long before anyone opens a spreadsheet.",
    topics: ["Public Health", "Medical AI"],
    daysAgo: 35,
    body: doc(
      p("Every national vaccination dashboard starts with a nurse writing a tally on paper at the end of a long shift."),
      p("When the numbers look wrong, the fix is rarely in the database. It's in understanding the clinic: which forms are confusing, which columns get skipped, and when the reporting deadline lands on the busiest day of the week."),
      h2("Design for the person holding the pen"),
      p("We cut our reporting form from three pages to one, moved it to the start of the shift, and saw missing data fall by half within two months. No software was involved."),
    ),
  },
  {
    author: 3,
    title: "How I Study Pharmacology Without Losing My Mind",
    subtitle: "A practical system for remembering hundreds of drugs, from a student who failed the first quiz.",
    topics: ["Med School"],
    daysAgo: 40,
    body: doc(
      p("I failed my first pharmacology quiz. Not narrowly. This is the system I built afterwards."),
      list([
        "Learn drug classes first, individual drugs second.",
        "For each class, know the mechanism, one key side effect and one contraindication.",
        "Spaced repetition every morning, 20 minutes, no exceptions.",
        "Teach one class out loud to a friend each week.",
      ]),
      p("The last one made the biggest difference. If I can't explain why a beta blocker is risky in asthma without notes, I don't know it yet."),
    ),
  },
];

const COMMENTS = [
  "This is exactly what my attending told me last week. Saving this.",
  "Beautifully written. The bit about asking the right question really landed.",
  "We see the same thing in emergency medicine. The history is the test.",
  "Thank you for sharing this. I start my rotation next month.",
  "Would love a follow-up on how your department set up the audits.",
];

async function main() {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(posts);
  if (n > 0) {
    console.log("Database already has stories. Skipping seed.");
    process.exit(0);
  }

  console.log("Creating topics…");
  const topicRows = await db
    .insert(topics)
    .values(TOPICS.map(([name, description]) => ({ name, slug: slugify(name), description })))
    .onConflictDoNothing()
    .returning();
  const topicByName = new Map(topicRows.map((t) => [t.name, t.id]));

  console.log("Creating accounts…");
  const adminEmail = (process.env.ADMIN_EMAILS ?? "admin@medteds.local").split(",")[0].trim();
  await auth.api.signUpEmail({ body: { name: "MedTeds Editor", email: adminEmail, password: PASSWORD } });
  const writerIds: string[] = [];
  for (const w of WRITERS) {
    const res = await auth.api.signUpEmail({ body: { name: w.name, email: w.email, password: PASSWORD } });
    writerIds.push(res.user.id);
    await db.update(user).set({ bio: w.bio, role: "author" }).where(sql`${user.id} = ${res.user.id}`);
  }

  console.log("Creating stories…");
  const postIds: string[] = [];
  for (const s of STORIES) {
    const id = newId();
    const text = storyText(s.body);
    const published = new Date(Date.now() - s.daysAgo * 86_400_000);
    await db.insert(posts).values({
      id,
      authorId: writerIds[s.author],
      title: s.title,
      subtitle: s.subtitle,
      slug: `${slugify(s.title)}-${id.slice(0, 6)}`,
      content: s.body,
      excerpt: makeExcerpt(text),
      readingMinutes: readingMinutes(text),
      status: "published",
      featured: !!s.featured,
      publishedAt: published,
      createdAt: published,
      updatedAt: published,
    });
    await db.insert(postTopics).values(s.topics.map((name) => ({ postId: id, topicId: topicByName.get(name)! })));
    postIds.push(id);
  }

  console.log("Adding claps, responses and follows…");
  for (const [i, postId] of postIds.entries()) {
    const authorIdx = STORIES[i].author;
    const readers = writerIds.filter((_, j) => j !== authorIdx);
    await db.insert(claps).values(readers.map((userId, j) => ({ userId, postId, count: ((i + 3) * (j + 7)) % 50 + 1 })));
    const responders = readers.slice(0, (i % 3) + 1);
    await db.insert(comments).values(
      responders.map((userId, j) => ({ id: newId(), postId, userId, body: COMMENTS[(i + j) % COMMENTS.length] })),
    );
  }
  await db.insert(follows).values([
    { followerId: writerIds[3], followingId: writerIds[0] },
    { followerId: writerIds[3], followingId: writerIds[4] },
    { followerId: writerIds[1], followingId: writerIds[2] },
    { followerId: writerIds[2], followingId: writerIds[0] },
  ]);

  console.log(`\nDone. Sign in as ${adminEmail} (admin) or any writer, e.g. amara@medteds.local.`);
  console.log(`Password for all sample accounts: ${PASSWORD}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
