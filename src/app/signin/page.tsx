import { redirect } from "next/navigation";
import { AuthForm, AuthShell } from "@/components/blog/auth-form";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/signin">) {
  const next = (await searchParams).next;
  if (await getCurrentUser()) redirect(typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/");
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to write, clap and save stories.">
      <AuthForm mode="signin" next={typeof next === "string" ? next : undefined} google={!!process.env.GOOGLE_CLIENT_ID} />
    </AuthShell>
  );
}
