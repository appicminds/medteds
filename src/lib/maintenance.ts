import "server-only";
import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { posts } from "@/db/schema";

export const TRASH_DAYS = 30;

/** Permanently removes stories that have been in the trash longer than TRASH_DAYS. */
export async function purgeOldTrash() {
  await db
    .delete(posts)
    .where(and(eq(posts.status, "trash"), lt(posts.trashedAt, sql`now() - make_interval(days => ${TRASH_DAYS})`)));
}
