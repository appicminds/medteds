import { redirect } from "next/navigation";
import { AuthForm, AuthShell } from "@/components/blog/auth-form";
import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import Link from "next/link";

export const metadata = { title: "Create your account" };

export default async function SignUpPage({ searchParams }: PageProps<"/signup">) {
  const next = (await searchParams).next;
  if (await getCurrentUser()) redirect("/");
  const settings = await getSettings();
  if (!settings.signupOpen) {
    return (
      <AuthShell title="Sign-ups are closed" subtitle={`New accounts on ${settings.siteName} are by invitation.`}>
        <p className="text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/signin" className="font-medium text-accent hover:underline">Sign in</Link>
        </p>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Join MedTeds" subtitle="Read and write stories about medicine and health.">
      <AuthForm mode="signup" next={typeof next === "string" ? next : undefined} google={!!process.env.GOOGLE_CLIENT_ID} />
    </AuthShell>
  );
}
