import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  username: string;
  bio: string | null;
  role: string;
};

/** The signed-in user for this request, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const u = session.user as typeof session.user & {
    username?: string | null;
    bio?: string | null;
    role?: string | null;
    banned?: boolean | null;
  };
  if (u.banned) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image ?? null,
    username: u.username ?? u.id,
    bio: u.bio ?? null,
    role: u.role ?? "user",
  };
});

export async function requireUser(returnTo = "/") {
  const u = await getCurrentUser();
  if (!u) redirect(`/signin?next=${encodeURIComponent(returnTo)}`);
  return u;
}

export async function requireAdmin() {
  const u = await requireUser("/admin");
  if (u.role !== "admin") redirect("/");
  return u;
}
