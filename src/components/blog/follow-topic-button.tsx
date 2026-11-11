"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toggleTopicFollow } from "@/lib/actions";

export function FollowTopicButton({
  topicId,
  topicName,
  following,
  signedIn,
  size = "sm",
  className,
}: {
  topicId: number;
  topicName: string;
  following: boolean;
  signedIn: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const [on, setOn] = useState(following);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      variant={on ? "outline" : "solid"}
      size={size}
      disabled={pending}
      aria-pressed={on}
      aria-label={`${on ? "Unfollow" : "Follow"} ${topicName}`}
      className={className}
      onClick={() => {
        if (!signedIn) return router.push(`/signin?next=${encodeURIComponent(location.pathname)}`);
        setOn(!on);
        start(async () => {
          const res = await toggleTopicFollow(topicId);
          if (res !== null) setOn(res);
          router.refresh();
        });
      }}
    >
      {on ? "Following" : "Follow"}
    </Button>
  );
}
