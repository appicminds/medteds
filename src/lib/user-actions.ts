"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { invites, pages, posts, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { emailEnabled, sendEmail, takeResetLink } from "@/lib/email";
import { can, ROLE_INFO, ROLES } from "@/lib/permissions";
import { requireCan } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { normalizeUsername } from "@/lib/usernames";
import { newId } from "@/lib/utils";

export type LinkResult = { ok: true; link: string; emailed: boolean; message: string } | { ok: false; error: string };
export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const INVITE_DAYS = 7;

async function siteUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return process.env.NEXT_PUBLIC_APP_URL ?? (host ? `${proto}://${host}` : "http://localhost:3000");
}

/* ------------------------------------------------------------------ */
/* Invitations                                                         */
/* ------------------------------------------------------------------ */

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  role: z.enum(ROLES),
});

export async function createInvite(_prev: LinkResult | null, form: FormData): Promise<LinkResult> {
  const me = await requireCan("manageUsers");
  const parsed = inviteSchema.safeParse({ email: form.get("email"), role: form.get("role") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { email, role } = parsed.data;
  const existing = await db.query.user.findFirst({ where: eq(user.email, email), columns: { id: true } });
  if (existing) return { ok: false, error: "This person already has an account. Change their role in the list below." };

  // Replace any earlier unused invitation for the same email.
  await db.delete(invites).where(and(eq(invites.email, email), isNull(invites.usedAt)));
  const id = newId(24);
  await db.insert(invites).values({ id, email, role, invitedBy: me.id, expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000) });

  const link = `${await siteUrl()}/invite/${id}`;
  const { siteName } = await getSettings();
  const emailed = await sendEmail(
    email,
    `You're invited to ${siteName}`,
    `${me.name} invited you to join ${siteName} as ${ROLE_INFO[role].label === "Administrator" ? "an" : "a"} ${ROLE_INFO[role].label}.\n\nCreate your account here (the link expires in ${INVITE_DAYS} days):\n\n${link}`,
  );
  revalidatePath("/admin/users");
  return {
    ok: true,
    link,
    emailed,
    message: emailed ? `Invitation emailed to ${email}.` : `Invitation created. Send this link to ${email}:`,
  };
}

export async function revokeInvite(id: string) {
  await requireCan("manageUsers");
  await db.delete(invites).where(eq(invites.id, id));
  revalidatePath("/admin/users");
}

/* ------------------------------------------------------------------ */
/* Editing and removing users                                          */
/* ------------------------------------------------------------------ */

const editSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "Enter a name.").max(60, "Names can be up to 60 characters."),
  username: z
    .string()
    .trim()
    .min(3, "Usernames need at least 3 characters.")
    .max(30, "Usernames can be up to 30 characters.")
    .regex(/^[a-z0-9_]+$/i, "Use only letters, numbers and underscores."),
  bio: z.string().trim().max(160, "Bios can be up to 160 characters."),
  role: z.enum(ROLES),
});

export async function adminUpdateUser(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const me = await requireCan("manageUsers");
  const parsed = editSchema.safeParse({
    id: form.get("id"),
    name: form.get("name"),
    username: form.get("username"),
    bio: form.get("bio") ?? "",
    role: form.get("role"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const username = normalizeUsername(d.username);
  const taken = await db.query.user.findFirst({ where: eq(user.username, username), columns: { id: true } });
  if (taken && taken.id !== d.id) return { ok: false, error: `@${username} is already taken.` };
  // Admins can't change their own role, so there's always at least one admin.
  const role = d.id === me.id ? me.role : d.role;
  await db.update(user).set({ name: d.name, username, bio: d.bio || null, role, updatedAt: new Date() }).where(eq(user.id, d.id));
  revalidatePath("/", "layout");
  return { ok: true, message: "User saved." };
}

export async function adminDeleteUser(id: string, reassignTo: string | null): Promise<ActionResult> {
  const me = await requireCan("manageUsers");
  if (id === me.id) return { ok: false, error: "You can't delete your own account here." };
  const target = await db.query.user.findFirst({ where: eq(user.id, id), columns: { id: true } });
  if (!target) return { ok: false, error: "That user no longer exists." };
  if (reassignTo) {
    const heir = await db.query.user.findFirst({ where: eq(user.id, reassignTo), columns: { id: true, role: true } });
    if (!heir || heir.id === id || !can(heir, "write")) return { ok: false, error: "Choose someone with writing access to take over the stories." };
    await db.update(posts).set({ authorId: heir.id }).where(eq(posts.authorId, id));
  }
  await db.update(pages).set({ authorId: null }).where(eq(pages.authorId, id));
  // Stories not reassigned, plus the user's claps, responses, follows and uploads, are removed with the account.
  await db.delete(user).where(eq(user.id, id));
  revalidatePath("/", "layout");
  return { ok: true, message: "User deleted." };
}

/** Creates a password-reset link for a user, emails it when email is set up, and returns it for the admin. */
export async function adminResetPassword(id: string): Promise<LinkResult> {
  await requireCan("manageUsers");
  const target = await db.query.user.findFirst({ where: eq(user.id, id), columns: { email: true } });
  if (!target) return { ok: false, error: "That user no longer exists." };
  await auth.api.requestPasswordReset({ body: { email: target.email, redirectTo: `${await siteUrl()}/reset-password` } });
  const link = takeResetLink(target.email);
  if (!link) return { ok: false, error: "This account signs in with Google and has no password to reset." };
  const emailed = emailEnabled();
  return {
    ok: true,
    link,
    emailed,
    message: emailed ? `Reset link emailed to ${target.email}. You can also send this link yourself:` : `Send this link to ${target.email}. It works once and expires in 1 hour:`,
  };
}
