"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toggleFollow } from "@/lib/actions";
import { cn } from "@/lib/utils";

export function FollowButton({
  userId,
  following,
  signedIn,
  variant = "button",
  className,
}: {
  userId: string;
  following: boolean;
  signedIn: boolean;
  variant?: "button" | "link";
  className?: string;
}) {
  const [on, setOn] = useState(following);
  const [pending, start] = useTransition();
  const router = useRouter();
  function onClick() {
    if (!signedIn) return router.push(`/signin?next=${encodeURIComponent(location.pathname)}`);
    setOn(!on);
    start(async () => {
      const res = await toggleFollow(userId);
      if (res !== null) setOn(res);
    });
  }
  if (variant === "link") {
    return (
      <button type="button" disabled={pending} onClick={onClick} className={cn("cursor-pointer text-accent hover:underline", className)}>
        {on ? "Following" : "Follow"}
      </button>
    );
  }
  return (
    <Button variant={on ? "outline" : "solid"} size="sm" disabled={pending} onClick={onClick} className={className}>
      {on ? "Following" : "Follow"}
    </Button>
  );
}
