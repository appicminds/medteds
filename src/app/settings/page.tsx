import { ProfileForm } from "@/components/cms/profile-form";
import { ThemeToggle } from "@/components/blog/theme-toggle";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const me = await requireUser("/settings");
  return (
    <main className="mx-auto max-w-[640px] px-4 pb-16 pt-12 sm:px-6">
      <h1 className="text-4xl font-bold tracking-tight">Settings</h1>

      <section className="mt-10">
        <h2 className="border-b border-line pb-3 text-lg font-semibold">Profile</h2>
        <div className="pt-6">
          <ProfileForm me={{ name: me.name, username: me.username, bio: me.bio ?? "", image: me.image ?? "" }} />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="border-b border-line pb-3 text-lg font-semibold">Appearance</h2>
        <div className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <div>
            <p className="font-medium">Theme</p>
            <p className="text-sm text-muted">&ldquo;Device&rdquo; follows your phone or computer setting.</p>
          </div>
          <ThemeToggle />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="border-b border-line pb-3 text-lg font-semibold">Account</h2>
        <div className="pt-6">
          <p className="font-medium">Email address</p>
          <p className="text-sm text-muted">{me.email}</p>
        </div>
      </section>
    </main>
  );
}
