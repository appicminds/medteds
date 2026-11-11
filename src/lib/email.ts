import "server-only";

/** Whether outgoing email is configured (Resend). Without it, admins share links by hand. */
export function emailEnabled() {
  return !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/** Sends an email through Resend. Returns false (instead of throwing) when email isn't set up or fails. */
export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  if (!emailEnabled()) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text }),
    });
    if (!res.ok) console.error("Email failed", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (e) {
    console.error("Email failed", e);
    return false;
  }
}

/**
 * Password-reset links created during the current request, so an admin can be shown the link
 * when email isn't configured. Entries are read once and removed.
 */
const resetLinks = new Map<string, string>();
export function rememberResetLink(email: string, url: string) {
  resetLinks.set(email.toLowerCase(), url);
  setTimeout(() => resetLinks.delete(email.toLowerCase()), 60_000).unref?.();
}
export function takeResetLink(email: string) {
  const url = resetLinks.get(email.toLowerCase());
  resetLinks.delete(email.toLowerCase());
  return url;
}
