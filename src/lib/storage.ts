import "server-only";
import { db } from "@/db";
import { media } from "@/db/schema";
import { newId } from "@/lib/utils";

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const ext: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Saves an image and returns its public URL.
 * Uses Supabase Storage when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set,
 * otherwise stores the bytes in Postgres and serves them from /api/media/[id].
 */
export async function saveImage(file: File, userId: string): Promise<string> {
  const id = newId(16);
  const bytes = Buffer.from(await file.arrayBuffer());
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || "media";
    const path = `${userId}/${id}.${ext[file.type] ?? "bin"}`;
    const res = await fetch(`${url}/storage/v1/object/${bucket}/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": file.type, "x-upsert": "false" },
      body: bytes,
    });
    if (!res.ok) throw new Error(`Storage upload failed (${res.status})`);
    return `${url}/storage/v1/object/public/${bucket}/${path}`;
  }
  await db.insert(media).values({ id, userId, mimeType: file.type, size: bytes.length, data: bytes });
  return `/api/media/${id}`;
}
