"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/field";
import { ROLE_INFO, ROLES, type Role } from "@/lib/permissions";
import { adminDeleteUser, adminResetPassword, adminUpdateUser, createInvite, revokeInvite, type LinkResult } from "@/lib/user-actions";

export function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor={`link-${link.slice(-8)}`} className="sr-only">Link</label>
      <Input id={`link-${link.slice(-8)}`} readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 font-mono text-xs" />
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {}
        }}
      >
        {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

function LinkMessage({ state }: { state: LinkResult | null }) {
  if (!state) return null;
  if (!state.ok) return <FormMessage tone="error">{state.error}</FormMessage>;
  return (
    <div className="flex flex-col gap-2">
      <FormMessage tone="success">{state.message}</FormMessage>
      <CopyLink link={state.link} />
    </div>
  );
}

export function InviteForm() {
  const [state, action, pending] = useActionState(createInvite, null);
  return (
    <form action={action} className="flex flex-col gap-3 rounded-md border border-line p-4">
      <h2 className="font-semibold">Invite someone</h2>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <Field label="Email" htmlFor="invite-email">
            <Input id="invite-email" name="email" type="email" required placeholder="name@example.com" />
          </Field>
        </div>
        <div>
          <Field label="Role" htmlFor="invite-role">
            <Select id="invite-role" name="role" defaultValue="author">
              {ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_INFO[r].label}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Button type="submit" variant="accent" disabled={pending}>
          {pending ? "Inviting…" : "Send invite"}
        </Button>
      </div>
      <LinkMessage state={state} />
    </form>
  );
}

export function RevokeInviteButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(() => revokeInvite(id))}>
      {pending ? "Revoking…" : "Revoke"}
    </Button>
  );
}

export function EditUserForm({ u, isMe }: { u: { id: string; name: string; username: string; bio: string; role: Role }; isMe: boolean }) {
  const [state, action, pending] = useActionState(adminUpdateUser, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={u.id} />
      <Field label="Name" htmlFor="u-name">
        <Input id="u-name" name="name" defaultValue={u.name} maxLength={60} required />
      </Field>
      <Field label="Username" htmlFor="u-username">
        <Input id="u-username" name="username" defaultValue={u.username} maxLength={30} required pattern="[A-Za-z0-9_]+" />
      </Field>
      <Field label="Bio" htmlFor="u-bio">
        <Textarea id="u-bio" name="bio" defaultValue={u.bio} maxLength={160} className="min-h-16" />
      </Field>
      <Field label="Role" htmlFor="u-role" hint={isMe ? "You can't change your own role." : undefined}>
        <Select id="u-role" name="role" defaultValue={u.role} disabled={isMe}>
          {ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_INFO[r].label}: {ROLE_INFO[r].description}</option>
          ))}
        </Select>
      </Field>
      {isMe ? <input type="hidden" name="role" value={u.role} /> : null}
      {state ? <FormMessage tone={state.ok ? "success" : "error"}>{state.ok ? state.message : state.error}</FormMessage> : null}
      <div>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
      </div>
    </form>
  );
}

export function ResetPasswordButton({ id }: { id: string }) {
  const [state, setState] = useState<LinkResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button variant="outline" size="sm" disabled={pending} onClick={() => start(async () => setState(await adminResetPassword(id)))}>
          {pending ? "Creating link…" : "Create password reset link"}
        </Button>
      </div>
      <LinkMessage state={state} />
    </div>
  );
}

export function DeleteUserForm({ id, name, storyCount, writers }: { id: string; name: string; storyCount: number; writers: { id: string; name: string }[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<"reassign" | "delete">(storyCount ? "reassign" : "delete");
  const [heir, setHeir] = useState(writers[0]?.id ?? "");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-3 text-sm">
      {storyCount ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1">
            {name} has {storyCount} {storyCount === 1 ? "story" : "stories"}. What should happen to {storyCount === 1 ? "it" : "them"}?
          </legend>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="radio" checked={mode === "reassign"} onChange={() => setMode("reassign")} className="accent-[var(--accent)]" />
            Give them to
            <label htmlFor="heir" className="sr-only">New author</label>
            <Select id="heir" value={heir} onChange={(e) => setHeir(e.target.value)} className="h-8 w-auto py-0 text-sm" disabled={mode !== "reassign"}>
              {writers.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </Select>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="radio" checked={mode === "delete"} onChange={() => setMode("delete")} className="accent-[var(--accent)]" />
            Delete them too
          </label>
        </fieldset>
      ) : null}
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      {confirm ? (
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-danger">Delete {name}&apos;s account for good?</span>
          <Button
            variant="danger"
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await adminDeleteUser(id, mode === "reassign" ? heir : null);
                if (res.ok) router.push("/admin/users");
                else setError(res.error);
              })
            }
          >
            {pending ? "Deleting…" : "Yes, delete"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>Cancel</Button>
        </span>
      ) : (
        <div>
          <Button variant="danger-outline" size="sm" onClick={() => setConfirm(true)}>Delete user</Button>
        </div>
      )}
    </div>
  );
}
