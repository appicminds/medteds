"use client";

import { useActionState, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/field";
import { uploadImage } from "@/components/cms/upload";
import { updateProfile } from "@/lib/actions";

export function ProfileForm({ me }: { me: { name: string; username: string; bio: string; image: string } }) {
  const [state, action, pending] = useActionState(updateProfile, null);
  const [image, setImage] = useState(me.image);
  const [name, setName] = useState(me.name);
  const [bio, setBio] = useState(me.bio);
  const [uploadError, setUploadError] = useState<string | null>(null);

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <Avatar name={name || "?"} src={image || null} size="lg" />
        <div className="flex flex-col gap-1">
          <label className="cursor-pointer text-sm text-accent hover:underline">
            Upload photo
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setUploadError(null);
                const res = await uploadImage(f);
                if ("error" in res) setUploadError(res.error);
                else setImage(res.url);
              }}
            />
          </label>
          {image ? (
            <button type="button" className="cursor-pointer text-left text-sm text-muted hover:text-fg" onClick={() => setImage("")}>
              Remove photo
            </button>
          ) : null}
        </div>
      </div>
      {uploadError ? <FormMessage tone="error">{uploadError}</FormMessage> : null}
      <input type="hidden" name="image" value={image} />
      <Field label="Name" htmlFor="name">
        <Input id="name" name="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
      </Field>
      <Field label="Username" htmlFor="username" hint="Your profile lives at medteds.com/@username.">
        <Input id="username" name="username" defaultValue={me.username} maxLength={30} required pattern="[A-Za-z0-9_]+" />
      </Field>
      <Field label="Short bio" htmlFor="bio" hint={`${bio.length}/160`}>
        <Textarea id="bio" name="bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} placeholder="Cardiologist writing about the human side of heart medicine." />
      </Field>
      {state ? <FormMessage tone={state.ok ? "success" : "error"}>{state.ok ? state.message : state.error}</FormMessage> : null}
      <div>
        <Button type="submit" variant="solid" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
