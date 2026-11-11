import { requireUser } from "@/lib/session";
import { StartDraft } from "@/components/cms/start-draft";

export const metadata = { title: "Write a story" };

// The draft is created by a POST from the browser, so link prefetching never creates empty drafts.
export default async function WritePage() {
  await requireUser("/write");
  return <StartDraft />;
}
