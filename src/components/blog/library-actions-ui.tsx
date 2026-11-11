"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/field";
import { clearHistory, createList, deleteList, removeHighlight, setSaved, toggleListSave, updateList } from "@/lib/library-actions";

/** "New list" button with an inline form. */
export function NewListButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!open)
    return (
      <Button variant="accent" size="sm" onClick={() => setOpen(true)}>
        New list
      </Button>
    );
  return (
    <form
      className="flex w-full flex-col gap-3 rounded-md border border-line p-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await createList({ name, description, isPublic });
          if (!res.ok) return setError(res.error);
          router.push(`/list/${res.id}`);
        });
      }}
    >
      <Field label="Name" htmlFor="list-name">
        <Input id="list-name" autoFocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <Field label="Description (optional)" htmlFor="list-desc">
        <Textarea id="list-desc" value={description} maxLength={280} onChange={(e) => setDescription(e.target.value)} className="min-h-16" />
      </Field>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
        Public: show this list on your profile
      </label>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <div className="flex gap-2">
        <Button type="submit" variant="solid" size="sm" disabled={pending}>
          {pending ? "Creating…" : "Create list"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** Owner controls on a list page: edit details, make public or private, delete. */
export function ListOwnerControls({ list }: { list: { id: string; name: string; description: string | null; isPublic: boolean } }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(list.name);
  const [description, setDescription] = useState(list.description ?? "");
  const [isPublic, setIsPublic] = useState(list.isPublic);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (editing)
    return (
      <form
        className="mt-6 flex flex-col gap-3 rounded-md border border-line p-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await updateList(list.id, { name, description, isPublic });
            if (!res.ok) return setError(res.error);
            setEditing(false);
            router.refresh();
          });
        }}
      >
        <Field label="Name" htmlFor="edit-list-name">
          <Input id="edit-list-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Description" htmlFor="edit-list-desc">
          <Textarea id="edit-list-desc" value={description} maxLength={280} onChange={(e) => setDescription(e.target.value)} className="min-h-16" />
        </Field>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
          Public: show this list on your profile
        </label>
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        <div className="flex gap-2">
          <Button type="submit" variant="solid" size="sm" disabled={pending}>Save</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      </form>
    );

  return (
    <div className="mt-5 flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Edit list</Button>
      {confirm ? (
        <>
          <span className="text-sm text-danger">Delete this list? The stories stay on MedTeds.</span>
          <Button
            variant="danger"
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await deleteList(list.id);
                if (res.ok) router.push("/library");
                else setError(res.error);
              })
            }
          >
            Delete
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>Cancel</Button>
        </>
      ) : (
        <Button variant="danger-outline" size="sm" onClick={() => setConfirm(true)}>Delete list</Button>
      )}
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </div>
  );
}

export function SaveListButton({ listId, saved, signedIn }: { listId: string; saved: boolean; signedIn: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(saved);
  const [pending, start] = useTransition();
  return (
    <Button
      variant={on ? "outline" : "solid"}
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!signedIn) return router.push(`/signin?next=${encodeURIComponent(location.pathname)}`);
        setOn(!on);
        start(async () => {
          const res = await toggleListSave(listId);
          if (res !== null) setOn(res);
          router.refresh();
        });
      }}
    >
      {on ? "Saved to library" : "Save list"}
    </Button>
  );
}

/** Small "remove" button next to a story in one of the reader's lists. */
export function RemoveFromListButton({ listId, postId, title }: { listId: string; postId: string; title: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`Remove “${title}” from this list`}
      title="Remove from list"
      onClick={() =>
        start(async () => {
          await setSaved(postId, listId, false);
          router.refresh();
        })
      }
      className="inline-flex cursor-pointer items-center gap-1 text-xs text-muted hover:text-danger"
    >
      <X size={14} /> Remove
    </button>
  );
}

export function RemoveHighlightButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await removeHighlight(id);
          router.refresh();
        })
      }
      className="cursor-pointer text-xs text-muted hover:text-danger"
    >
      Remove
    </button>
  );
}

export function ClearHistoryButton() {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  if (!confirm)
    return (
      <Button variant="outline" size="sm" onClick={() => setConfirm(true)}>
        Clear history
      </Button>
    );
  return (
    <span className="flex items-center gap-2">
      <span className="text-sm text-muted">Clear your whole reading history?</span>
      <Button
        variant="danger"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await clearHistory();
            setConfirm(false);
            router.refresh();
          })
        }
      >
        Clear
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>Cancel</Button>
    </span>
  );
}
