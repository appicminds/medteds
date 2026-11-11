"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";

export function ForgotPasswordForm({ emailEnabled }: { emailEnabled: boolean }) {
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  if (!emailEnabled) {
    return (
      <p className="text-center text-sm text-muted">
        Email isn&apos;t set up on this site yet, so ask an administrator to create a reset link for you from the Users
        page. <Link href="/signin" className="text-accent hover:underline">Back to sign in</Link>
      </p>
    );
  }
  if (done) {
    return <FormMessage tone="success">If an account uses that email, a reset link is on its way. Check your inbox.</FormMessage>;
  }
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
        await authClient.requestPasswordReset({ email, redirectTo: `${location.origin}/reset-password` });
        setPending(false);
        setDone(true);
      }}
    >
      <Field label="Email" htmlFor="fp-email">
        <Input id="fp-email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Button type="submit" size="lg" disabled={pending}>{pending ? "Sending…" : "Send reset link"}</Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        const f = new FormData(e.currentTarget);
        const pw = String(f.get("password") ?? "");
        if (pw !== String(f.get("confirm") ?? "")) return setError("The two passwords don't match.");
        setPending(true);
        const res = await authClient.resetPassword({ newPassword: pw, token });
        setPending(false);
        if (res.error) return setError(res.error.message?.includes("token") ? "This link has expired. Ask for a new one." : (res.error.message ?? "Something went wrong. Try again."));
        router.push("/signin?reset=1");
      }}
    >
      <Field label="New password" htmlFor="rp-password" hint="At least 8 characters.">
        <Input id="rp-password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Field label="Type it again" htmlFor="rp-confirm">
        <Input id="rp-confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <Button type="submit" size="lg" disabled={pending}>{pending ? "Saving…" : "Save new password"}</Button>
    </form>
  );
}

export function ChangePasswordForm() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <form
      className="flex max-w-md flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setMsg(null);
        const form = e.currentTarget;
        const f = new FormData(form);
        const next = String(f.get("new") ?? "");
        if (next !== String(f.get("confirm") ?? "")) return setMsg({ ok: false, text: "The new passwords don't match." });
        setPending(true);
        const res = await authClient.changePassword({
          currentPassword: String(f.get("current") ?? ""),
          newPassword: next,
          revokeOtherSessions: true,
        });
        setPending(false);
        if (res.error) {
          setMsg({ ok: false, text: /invalid|incorrect/i.test(res.error.message ?? "") ? "Your current password isn't right." : (res.error.message ?? "Couldn't change the password.") });
          return;
        }
        form.reset();
        setMsg({ ok: true, text: "Password changed. Other devices have been signed out." });
      }}
    >
      <Field label="Current password" htmlFor="cp-current">
        <Input id="cp-current" name="current" type="password" autoComplete="current-password" required />
      </Field>
      <Field label="New password" htmlFor="cp-new" hint="At least 8 characters.">
        <Input id="cp-new" name="new" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Field label="Type the new password again" htmlFor="cp-confirm">
        <Input id="cp-confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      {msg ? <FormMessage tone={msg.ok ? "success" : "error"}>{msg.text}</FormMessage> : null}
      <div>
        <Button type="submit" disabled={pending}>{pending ? "Changing…" : "Change password"}</Button>
      </div>
    </form>
  );
}
