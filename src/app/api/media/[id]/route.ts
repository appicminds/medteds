import { eq } from "drizzle-orm";
import { db } from "@/db";
import { media } from "@/db/schema";

export async function GET(_req: Request, ctx: RouteContext<"/api/media/[id]">) {
  const { id } = await ctx.params;
  const row = await db.query.media.findFirst({ where: eq(media.id, id) });
  if (!row?.data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(row.data), {
    headers: {
      "Content-Type": row.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
