import { StaticPage } from "@/components/blog/static-page";

export const metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <StaticPage title="Privacy policy" updated="November 2026">
      <p>
        This is a starting template. Replace it with a policy reviewed for your organisation and the places you
        operate before launch.
      </p>
      <h2>What we collect</h2>
      <p>
        Your name, email address and password (stored as a secure hash) when you create an account; the stories,
        responses and images you publish; and which stories you clap for, save or respond to.
      </p>
      <h2>How we use it</h2>
      <p>To run your account, show your stories to readers, and personalise your feed. We do not sell your data.</p>
      <h2>Your choices</h2>
      <p>You can edit your profile, unpublish or delete your stories at any time, and ask us to delete your account.</p>
    </StaticPage>
  );
}
