import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { user as userTable } from "@/db/schema";
import { asRole, can, type Action, type Role } from "@/lib/permissions";

const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  username: string;
  bio: string | null;
  role: Role;
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
  let role = asRole(u.role);
  // Accounts listed in ADMIN_EMAILS become admins even if they signed up before being listed.
  if (role !== "admin" && adminEmails.includes(u.email.toLowerCase())) {
    await db.update(userTable).set({ role: "admin" }).where(eq(userTable.id, u.id));
    role = "admin";
  }
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image ?? null,
    username: u.username ?? u.id,
    bio: u.bio ?? null,
    role,
  };
});

export async function requireUser(returnTo = "/") {
  const u = await getCurrentUser();
  if (!u) redirect(`/signin?next=${encodeURIComponent(returnTo)}`);
  return u;
}

/** The signed-in user, if allowed to do `action`; otherwise sends them to sign in or home. */
export async function requireCan(action: Action, returnTo = "/") {
  const u = await requireUser(returnTo);
  if (!can(u, action)) redirect(action === "write" ? "/write/request-access" : "/");
  return u;
}
