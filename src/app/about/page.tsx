import Link from "next/link";
import { StaticPage } from "@/components/blog/static-page";

export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <StaticPage title="About MedTeds">
      <p>
        MedTeds is a place for the people who practise, study and research medicine to write about it in their own
        words: the cases that changed their thinking, the research behind the headlines, and what life on the wards is
        really like.
      </p>
      <h2>Who writes here</h2>
      <p>
        Doctors, nurses, pharmacists, researchers, public health workers, students and patients. Anyone can sign up
        and publish a story.
      </p>
      <h2>A note on medical advice</h2>
      <p>
        Stories on MedTeds share experience and ideas. They are not personal medical advice. Talk to a qualified
        clinician about your own health.
      </p>
      <p>
        Ready to share something? <Link href="/write">Start writing</Link>.
      </p>
    </StaticPage>
  );
}
