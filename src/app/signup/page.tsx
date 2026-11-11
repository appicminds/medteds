import { redirect } from "next/navigation";
import { AuthForm, AuthShell } from "@/components/blog/auth-form";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Create your account" };

export default async function SignUpPage({ searchParams }: PageProps<"/signup">) {
  const next = (await searchParams).next;
  if (await getCurrentUser()) redirect("/");
  return (
    <AuthShell title="Join MedTeds" subtitle="Read and write stories about medicine and health.">
      <AuthForm mode="signup" next={typeof next === "string" ? next : undefined} google={!!process.env.GOOGLE_CLIENT_ID} />
    </AuthShell>
  );
}
