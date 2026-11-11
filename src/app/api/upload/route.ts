import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, saveImage } from "@/lib/storage";

export async function POST(request: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Sign in to upload images." }, { status: 401 });
  // Profile photos are allowed for everyone; other uploads need a writing role.
  const purpose = new URL(request.url).searchParams.get("purpose");
  if (purpose !== "avatar" && !can(me, "upload")) {
    return NextResponse.json({ error: "You need writing access to upload images." }, { status: 403 });
  }
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return NextResponse.json({ error: "Use a JPG, PNG, WebP or GIF image." }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Images can be up to 5 MB." }, { status: 400 });
  }
  try {
    const num = (k: string) => Number(form.get(k)) || null;
    const saved = await saveImage(file, me.id, { width: num("width"), height: num("height") });
    return NextResponse.json(saved);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Upload failed. Try again in a moment." }, { status: 500 });
  }
}
