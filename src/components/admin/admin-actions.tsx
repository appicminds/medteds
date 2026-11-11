"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { adminDeleteTopic, adminSetBanned, adminSetRole } from "@/lib/actions";
import { ROLE_INFO, ROLES, type Role } from "@/lib/permissions";

/** A small button that runs a server action, with an optional inline "Are you sure?" step. */
function ActionButton({
  label,
  pendingLabel,
  run,
  confirm,
  variant = "ghost",
}: {
  label: string;
  pendingLabel?: string;
  run: () => Promise<unknown>;
  confirm?: string;
  variant?: "ghost" | "outline" | "danger-outline";
}) {
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  if (asking) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="text-xs text-danger">{confirm}</span>
        <Button
          size="sm"
          variant="danger"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await run();
              setAsking(false);
            })
          }
        >
          {pending ? pendingLabel ?? "Working…" : "Yes"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>
          No
        </Button>
      </span>
    );
  }
  return (
    <Button
      size="sm"
      variant={variant}
      disabled={pending}
      onClick={() => (confirm ? setAsking(true) : start(async () => void (await run())))}
    >
      {pending ? pendingLabel ?? "Working…" : label}
    </Button>
  );
}

export function UserAdminActions({ id, role, banned, isMe, name }: { id: string; role: Role; banned: boolean; isMe: boolean; name: string }) {
  const [pending, start] = useTransition();
  const [value, setValue] = useState<Role>(role);
  if (isMe) return <span className="text-xs text-muted">This is you</span>;
  return (
    <span className="flex flex-wrap items-center justify-end gap-1">
      <label htmlFor={`role-${id}`} className="sr-only">Role for {name}</label>
      <Select
        id={`role-${id}`}
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as Role;
          setValue(next);
          start(() => adminSetRole(id, next));
        }}
        className="h-8 w-auto py-0 text-sm"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>{ROLE_INFO[r].label}</option>
        ))}
      </Select>
      <ActionButton
        label={banned ? "Restore" : "Suspend"}
        confirm={banned ? undefined : "Suspend and sign out?"}
        run={() => adminSetBanned(id, !banned)}
      />
    </span>
  );
}

export function TopicDeleteButton({ id }: { id: number }) {
  return <ActionButton label="Delete" confirm="Delete topic?" run={() => adminDeleteTopic(id)} />;
}
