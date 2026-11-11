import { AuthShell } from "@/components/blog/auth-form";
import { ForgotPasswordForm } from "@/components/blog/password-forms";
import { emailEnabled } from "@/lib/email";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Forgot your password?" subtitle={emailEnabled() ? "We'll email you a link to choose a new one." : "An administrator can send you a reset link."}>
      <ForgotPasswordForm emailEnabled={emailEnabled()} />
    </AuthShell>
  );
}
