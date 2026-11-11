import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { uniqueUsername } from "@/lib/usernames";
import { getSettings } from "@/lib/settings";
import { rememberResetLink, sendEmail } from "@/lib/email";
import { and, eq, gt, isNull } from "drizzle-orm";

const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const google =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
      }
    : undefined;

// Vercel serves the site at several addresses (production alias, per-deploy and per-branch URLs).
// Sign-in only accepts requests from trusted addresses, so list the ones Vercel provides.
const trustedOrigins = [
  process.env.BETTER_AUTH_URL,
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
  process.env.VERCEL_BRANCH_URL && `https://${process.env.VERCEL_BRANCH_URL}`,
  process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
  ...(process.env.TRUSTED_ORIGINS ?? "").split(",").map((o) => o.trim()),
].filter((o): o is string => !!o);

export const auth = betterAuth({
  trustedOrigins,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      rememberResetLink(user.email, url);
      await sendEmail(
        user.email,
        "Reset your password",
        `Hi ${user.name},\n\nUse this link to choose a new password. It works once and expires in 1 hour:\n\n${url}\n\nIf you didn't ask for this, you can ignore this email.`,
      );
    },
  },
  socialProviders: google,
  user: {
    additionalFields: {
      username: { type: "string", required: false, input: false },
      bio: { type: "string", required: false, input: false },
      role: { type: "string", required: false, defaultValue: "subscriber", input: false },
      banned: { type: "boolean", required: false, defaultValue: false, input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Give every new account a unique @username. ADMIN_EMAILS become admins; everyone else
        // starts as a Subscriber until an admin gives them a writing role.
        before: async (data) => {
          const email = data.email.toLowerCase();
          const isAdmin = adminEmails.includes(email);
          // An unused invitation for this email decides the role and works even when sign-ups are closed.
          const invite = await db.query.invites.findFirst({
            where: and(eq(schema.invites.email, email), isNull(schema.invites.usedAt), gt(schema.invites.expiresAt, new Date())),
          });
          if (!isAdmin && !invite && !(await getSettings()).signupOpen) return false;
          const username = await uniqueUsername(data.name || email.split("@")[0]);
          const role = isAdmin ? "admin" : (invite?.role ?? "subscriber");
          return { data: { ...data, username, role } };
        },
        after: async (created) => {
          await db
            .update(schema.invites)
            .set({ usedAt: new Date() })
            .where(and(eq(schema.invites.email, created.email.toLowerCase()), isNull(schema.invites.usedAt)));
        },
      },
    },
    session: {
      create: {
        // Suspended accounts cannot sign in.
        before: async (s) => {
          const u = await db.query.user.findFirst({
            where: (t, { eq }) => eq(t.id, s.userId),
            columns: { banned: true },
          });
          if (u?.banned) return false;
          return { data: s };
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
