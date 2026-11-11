import { db } from "@/db";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";

export function slugify(input: string, max = 60) {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

export function normalizeUsername(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "")
    .slice(0, 30);
}

/** Returns a username based on `base` that no other account uses yet. */
export async function uniqueUsername(base: string) {
  const root = normalizeUsername(base) || "writer";
  let candidate = root;
  for (let i = 0; i < 50; i++) {
    const taken = await db.query.user.findFirst({
      where: eq(user.username, candidate),
      columns: { id: true },
    });
    if (!taken) return candidate;
    candidate = `${root}${Math.floor(Math.random() * 9000 + 1000)}`;
  }
  return `${root}${Date.now()}`;
}
