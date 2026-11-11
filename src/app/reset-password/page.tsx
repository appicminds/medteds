import Link from "next/link";
import { AuthShell } from "@/components/blog/auth-form";
import { ResetPasswordForm } from "@/components/blog/password-forms";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : null;
  if (!token || sp.error) {
    return (
      <AuthShell title="This link has expired" subtitle="Password reset links work once and expire after an hour.">
        <p className="text-center text-sm text-muted">
          <Link href="/forgot-password" className="text-accent hover:underline">Ask for a new link</Link>
        </p>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Choose a new password" subtitle="You'll be signed out of other devices.">
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
