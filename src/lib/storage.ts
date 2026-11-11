import "server-only";
import { eq } from "drizzle-orm";
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

function supabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key, bucket: process.env.SUPABASE_STORAGE_BUCKET || "media" } : null;
}

function cleanFilename(name: string) {
  return name.replace(/[^\w.\- ]+/g, "").trim().slice(0, 120) || "image";
}

/**
 * Saves an image, records it in the media library and returns its id and public URL.
 * Uses Supabase Storage when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set,
 * otherwise stores the bytes in Postgres and serves them from /api/media/[id].
 */
export async function saveImage(
  file: File,
  userId: string,
  dims: { width?: number | null; height?: number | null } = {},
): Promise<{ id: string; url: string }> {
  const id = newId(16);
  const bytes = Buffer.from(await file.arrayBuffer());
  const base = {
    id,
    userId,
    filename: cleanFilename(file.name),
    mimeType: file.type,
    size: bytes.length,
    width: dims.width && dims.width > 0 ? Math.round(dims.width) : null,
    height: dims.height && dims.height > 0 ? Math.round(dims.height) : null,
  };
  const sb = supabase();
  if (sb) {
    const path = `${userId}/${id}.${ext[file.type] ?? "bin"}`;
    const res = await fetch(`${sb.url}/storage/v1/object/${sb.bucket}/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${sb.key}`, "Content-Type": file.type, "x-upsert": "false" },
      body: bytes,
    });
    if (!res.ok) throw new Error(`Storage upload failed (${res.status})`);
    const url = `${sb.url}/storage/v1/object/public/${sb.bucket}/${path}`;
    await db.insert(media).values({ ...base, url, storage: "supabase", data: null });
    return { id, url };
  }
  const url = `/api/media/${id}`;
  await db.insert(media).values({ ...base, url, storage: "db", data: bytes });
  return { id, url };
}

/** Removes the file from storage and the library. */
export async function removeImage(id: string) {
  const row = await db.query.media.findFirst({ where: eq(media.id, id), columns: { url: true, storage: true } });
  if (!row) return;
  const sb = supabase();
  if (row.storage === "supabase" && sb) {
    const path = row.url.split(`/object/public/${sb.bucket}/`)[1];
    if (path) {
      await fetch(`${sb.url}/storage/v1/object/${sb.bucket}/${path}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${sb.key}` },
      }).catch(() => {});
    }
  }
  await db.delete(media).where(eq(media.id, id));
}
