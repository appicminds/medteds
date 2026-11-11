"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bookmarks, highlights, listItems, listSaves, lists, posts, readingHistory } from "@/db/schema";
import { isLive } from "@/lib/live";
import { getCurrentUser } from "@/lib/session";
import { newId } from "@/lib/utils";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const MAX_LISTS = 100;

async function me() {
  const u = await getCurrentUser();
  if (!u) throw new Error("Sign in first.");
  return u;
}

async function ownList(listId: string, userId: string) {
  const l = await db.query.lists.findFirst({ where: and(eq(lists.id, listId), eq(lists.userId, userId)) });
  if (!l) throw new Error("That list no longer exists.");
  return l;
}

function refresh(listId?: string) {
  revalidatePath("/library");
  revalidatePath("/reading-list");
  if (listId) revalidatePath(`/list/${listId}`);
}

/* ------------------------------------------------------------------ */
/* Saving stories                                                      */
/* ------------------------------------------------------------------ */

export type SaveState = { readingList: boolean; lists: { id: string; name: string; isPublic: boolean; has: boolean }[] };

/** Where this story is saved, for the save menu. */
export async function getSaveState(postId: string): Promise<SaveState | null> {
  const u = await getCurrentUser();
  if (!u) return null;
  const [rl, own, inLists] = await Promise.all([
    db.query.bookmarks.findFirst({ where: and(eq(bookmarks.userId, u.id), eq(bookmarks.postId, postId)) }),
    db.select({ id: lists.id, name: lists.name, isPublic: lists.isPublic }).from(lists).where(eq(lists.userId, u.id)).orderBy(asc(lists.createdAt)),
    db
      .select({ id: listItems.listId })
      .from(listItems)
      .innerJoin(lists, eq(listItems.listId, lists.id))
      .where(and(eq(lists.userId, u.id), eq(listItems.postId, postId))),
  ]);
  const has = new Set(inLists.map((r) => r.id));
  return { readingList: !!rl, lists: own.map((l) => ({ ...l, has: has.has(l.id) })) };
}

/** Adds the story to, or removes it from, the reading list ("reading") or one of the reader's lists. */
export async function setSaved(postId: string, target: string, on: boolean): Promise<Result> {
  try {
    const u = await me();
    const post = await db.query.posts.findFirst({ where: eq(posts.id, postId), columns: { status: true, publishedAt: true } });
    if (on && (!post || !isLive(post))) return { ok: false, error: "This story is no longer available." };
    if (target === "reading") {
      if (on) await db.insert(bookmarks).values({ userId: u.id, postId }).onConflictDoNothing();
      else await db.delete(bookmarks).where(and(eq(bookmarks.userId, u.id), eq(bookmarks.postId, postId)));
    } else {
      await ownList(target, u.id);
      if (on) await db.insert(listItems).values({ listId: target, postId }).onConflictDoNothing();
      else await db.delete(listItems).where(and(eq(listItems.listId, target), eq(listItems.postId, postId)));
      await db.update(lists).set({ updatedAt: new Date() }).where(eq(lists.id, target));
    }
    refresh(target === "reading" ? undefined : target);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/* ------------------------------------------------------------------ */
/* Lists                                                               */
/* ------------------------------------------------------------------ */

const listSchema = z.object({
  name: z.string().trim().min(1, "Give the list a name.").max(60, "List names can be up to 60 characters."),
  description: z.string().trim().max(280, "Descriptions can be up to 280 characters.").optional().default(""),
  isPublic: z.boolean(),
});

export async function createList(input: z.input<typeof listSchema>, addPostId?: string): Promise<Result<{ id: string }>> {
  try {
    const u = await me();
    const parsed = listSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const count = await db.$count(lists, eq(lists.userId, u.id));
    if (count >= MAX_LISTS) return { ok: false, error: `You can have up to ${MAX_LISTS} lists.` };
    const id = newId(12);
    await db.insert(lists).values({ id, userId: u.id, name: parsed.data.name, description: parsed.data.description || null, isPublic: parsed.data.isPublic });
    if (addPostId) await db.insert(listItems).values({ listId: id, postId: addPostId }).onConflictDoNothing();
    refresh();
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function updateList(id: string, input: z.input<typeof listSchema>): Promise<Result> {
  try {
    const u = await me();
    await ownList(id, u.id);
    const parsed = listSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    await db
      .update(lists)
      .set({ name: parsed.data.name, description: parsed.data.description || null, isPublic: parsed.data.isPublic, updatedAt: new Date() })
      .where(eq(lists.id, id));
    // A list made private disappears from other readers' libraries.
    if (!parsed.data.isPublic) await db.delete(listSaves).where(eq(listSaves.listId, id));
    refresh(id);
    revalidatePath(`/@${u.username}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteList(id: string): Promise<Result> {
  try {
    const u = await me();
    await ownList(id, u.id);
    await db.delete(lists).where(eq(lists.id, id));
    refresh(id);
    revalidatePath(`/@${u.username}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Saves someone else's public list to the reader's library, or removes it. */
export async function toggleListSave(listId: string): Promise<boolean | null> {
  const u = await getCurrentUser();
  if (!u) return null;
  const l = await db.query.lists.findFirst({ where: eq(lists.id, listId), columns: { userId: true, isPublic: true } });
  if (!l || !l.isPublic || l.userId === u.id) return null;
  const where = and(eq(listSaves.userId, u.id), eq(listSaves.listId, listId));
  const existing = await db.query.listSaves.findFirst({ where });
  if (existing) await db.delete(listSaves).where(where);
  else await db.insert(listSaves).values({ userId: u.id, listId }).onConflictDoNothing();
  refresh(listId);
  return !existing;
}

/* ------------------------------------------------------------------ */
/* Highlights                                                          */
/* ------------------------------------------------------------------ */

const highlightSchema = z.object({
  postId: z.string().min(1).max(40),
  text: z.string().trim().min(3, "Select a few words to highlight.").max(1000, "Highlights can be up to 1,000 characters."),
  prefix: z.string().max(64),
  suffix: z.string().max(64),
});

export async function addHighlight(input: z.input<typeof highlightSchema>): Promise<Result<{ id: string }>> {
  const u = await getCurrentUser();
  if (!u) return { ok: false, error: "Sign in to highlight." };
  const parsed = highlightSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const post = await db.query.posts.findFirst({ where: eq(posts.id, parsed.data.postId), columns: { status: true, publishedAt: true } });
  if (!post || !isLive(post)) return { ok: false, error: "This story is no longer available." };
  const id = newId();
  await db.insert(highlights).values({ id, userId: u.id, ...parsed.data });
  revalidatePath("/library");
  return { ok: true, id };
}

export async function removeHighlight(id: string): Promise<Result> {
  const u = await getCurrentUser();
  if (!u) return { ok: false, error: "Sign in first." };
  await db.delete(highlights).where(and(eq(highlights.id, id), eq(highlights.userId, u.id)));
  revalidatePath("/library");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Reading history                                                     */
/* ------------------------------------------------------------------ */

export async function clearHistory(postIds?: string[]): Promise<Result> {
  const u = await getCurrentUser();
  if (!u) return { ok: false, error: "Sign in first." };
  await db
    .delete(readingHistory)
    .where(postIds?.length ? and(eq(readingHistory.userId, u.id), inArray(readingHistory.postId, postIds)) : eq(readingHistory.userId, u.id));
  revalidatePath("/library");
  return { ok: true };
}
