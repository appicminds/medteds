import { ButtonLink } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Writing on MedTeds" };

export default async function RequestAccessPage() {
  const me = await getCurrentUser();
  return (
    <main className="mx-auto flex max-w-[560px] flex-col items-center gap-4 px-4 py-20 text-center">
      <h1 className="text-3xl font-bold tracking-tight">Writing is by invitation</h1>
      <p className="text-muted">
        MedTeds stories are written by our editorial team and invited contributors. Your account can read, clap,
        respond to and save stories.
      </p>
      <p className="text-muted">
        Want to write for us? Ask an editor to give your account
        {me ? <> (<span className="font-medium text-fg">{me.email}</span>)</> : null} writing access.
      </p>
      <ButtonLink href="/" variant="outline" className="mt-2">
        Back to stories
      </ButtonLink>
    </main>
  );
}
