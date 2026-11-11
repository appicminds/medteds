import { StaticPage } from "@/components/blog/static-page";

export const metadata = { title: "Terms of service" };

export default function TermsPage() {
  return (
    <StaticPage title="Terms of service" updated="November 2026">
      <p>
        This is a starting template. Replace it with terms reviewed for your organisation before launch.
      </p>
      <h2>Your content</h2>
      <p>
        You own what you write. By publishing on MedTeds you let us display and distribute it on the site. Only
        publish work you have the right to share, and never share identifiable patient information.
      </p>
      <h2>Community rules</h2>
      <p>
        No harassment, spam, or health misinformation presented as fact. Editors may remove stories or responses and
        suspend accounts that break these rules.
      </p>
      <h2>Not medical advice</h2>
      <p>Content on MedTeds is for general information and is not a substitute for professional medical care.</p>
    </StaticPage>
  );
}
