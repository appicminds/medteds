import { AdminHeader } from "@/components/admin/page-header";
import { SettingsForm } from "@/components/admin/settings-form";
import { requireCan } from "@/lib/session";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Settings" };

export default async function AdminSettings() {
  await requireCan("manageSettings", "/admin/settings");
  const s = await getSettings();
  return (
    <>
      <AdminHeader title="Settings" description="Your site's name, look, sign-ups and response rules." />
      <SettingsForm
        initial={{
          siteName: s.siteName,
          tagline: s.tagline,
          logoUrl: s.logoUrl ?? "",
          accentColor: s.accentColor ?? "",
          social: s.social,
          signupOpen: s.signupOpen,
          commentApproval: s.commentApproval,
        }}
      />
    </>
  );
}
