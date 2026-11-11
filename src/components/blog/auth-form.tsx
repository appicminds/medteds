"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/field";
import { signIn, signUp } from "@/lib/auth-client";

function safeNext(next: string | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export function AuthForm({
  mode,
  next,
  google,
  fixedEmail,
  showSignupLink = true,
}: {
  mode: "signin" | "signup";
  next?: string;
  google: boolean;
  fixedEmail?: string;
  showSignupLink?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const target = safeNext(next);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const f = new FormData(e.currentTarget);
    const email = fixedEmail ?? String(f.get("email") ?? "").trim();
    const password = String(f.get("password") ?? "");
    const res =
      mode === "signup"
        ? await signUp.email({ name: String(f.get("name") ?? "").trim(), email, password })
        : await signIn.email({ email, password });
    setPending(false);
    if (res.error) {
      const msg = res.error.message ?? "";
      if (res.error.status === 401 || /invalid/i.test(msg)) setError("That email and password don't match. Check them and try again.");
      else if (/exists/i.test(msg)) setError("An account with this email already exists. Sign in instead.");
      else if (/password/i.test(msg) && /short/i.test(msg)) setError("Use a password with at least 8 characters.");
      else if (mode === "signup" && /create|failed/i.test(msg)) setError("New accounts are by invitation right now.");
      else if (res.error.status === 403 || /session/i.test(msg)) setError("This account has been suspended. Contact the editors if you think this is a mistake.");
      else setError(msg || "Something went wrong. Try again.");
      return;
    }
    // New readers pick their interests first, then carry on to where they were going.
    router.push(mode === "signup" ? `/welcome/topics?next=${encodeURIComponent(target)}` : target);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      {google ? (
        <>
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={() => signIn.social({ provider: "google", callbackURL: target })}
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
            </svg>
            Continue with Google
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-line" /> or use email <span className="h-px flex-1 bg-line" />
          </div>
        </>
      ) : null}
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {mode === "signup" ? (
          <Field label="Your name" htmlFor="name">
            <Input id="name" name="name" autoComplete="name" required maxLength={60} />
          </Field>
        ) : null}
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={fixedEmail}
            readOnly={!!fixedEmail}
            className={fixedEmail ? "bg-surface" : undefined}
          />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          hint={
            mode === "signup" ? (
              "At least 8 characters."
            ) : (
              <Link href="/forgot-password" className="hover:text-fg hover:underline">
                Forgot password?
              </Link>
            )
          }
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            minLength={8}
            required
          />
        </Field>
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        <Button type="submit" variant="solid" size="lg" disabled={pending} className="mt-2 w-full">
          {pending ? (mode === "signup" ? "Creating account…" : "Signing in…") : mode === "signup" ? "Create account" : "Sign in"}
        </Button>
      </form>
      {showSignupLink ? <p className="text-center text-sm text-muted">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <Link href={`/signin${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-accent hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New to MedTeds?{" "}
            <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-accent hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p> : null}
    </div>
  );
}

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="flex justify-center px-4 py-14 sm:py-20">
      <div className="w-full max-w-[420px]">
        <h1 className="text-center font-serif text-3xl font-bold">{title}</h1>
        <p className="mb-8 mt-2 text-center text-muted">{subtitle}</p>
        {children}
        <p className="mt-8 text-center text-xs text-muted">
          By continuing you agree to our <Link href="/terms" className="underline">Terms</Link> and{" "}
          <Link href="/privacy" className="underline">Privacy policy</Link>.
        </p>
      </div>
    </main>
  );
}
