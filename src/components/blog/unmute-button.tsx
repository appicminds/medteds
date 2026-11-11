"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toggleMute } from "@/lib/actions";

export function UnmuteButton({ type, id, name }: { type: "user" | "topic"; id: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      aria-label={`Unmute ${name}`}
      onClick={() =>
        start(async () => {
          await toggleMute(type, id);
          router.refresh();
        })
      }
    >
      Unmute
    </Button>
  );
}
