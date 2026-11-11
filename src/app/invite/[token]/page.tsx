import Link from "next/link";
import { eq } from "drizzle-orm";
import { AuthForm, AuthShell } from "@/components/blog/auth-form";
import { db } from "@/db";
import { invites } from "@/db/schema";
import { asRole, ROLE_INFO } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Accept invitation" };

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const [invite, me, settings] = await Promise.all([
    db.query.invites.findFirst({ where: eq(invites.id, token) }),
    getCurrentUser(),
    getSettings(),
  ]);
  const valid = invite && !invite.usedAt && invite.expiresAt > new Date();
  if (!valid) {
    return (
      <AuthShell title="This invitation has expired" subtitle="Invitation links work once and expire after 7 days.">
        <p className="text-center text-sm text-muted">
          Ask the person who invited you for a new link, or <Link href="/signin" className="text-accent hover:underline">sign in</Link> if you already have an account.
        </p>
      </AuthShell>
    );
  }
  const role = ROLE_INFO[asRole(invite.role)];
  if (me) {
    return (
      <AuthShell title="You're already signed in" subtitle={`This invitation is for ${invite.email}.`}>
        <p className="text-center text-sm text-muted">Sign out first, then open the invitation link again to create the new account.</p>
      </AuthShell>
    );
  }
  return (
    <AuthShell title={`Join ${settings.siteName}`} subtitle={`You've been invited as ${role.label === "Administrator" ? "an" : "a"} ${role.label}. ${role.description}`}>
      <AuthForm mode="signup" google={false} fixedEmail={invite.email} showSignupLink={false} />
    </AuthShell>
  );
}
