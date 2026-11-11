/* eslint-disable @next/next/no-img-element */
import { cn, hashHue } from "@/lib/utils";

/** Story image, or a generated pattern when the story has none. */
export function Cover({ src, seed, className }: { src?: string | null; seed: string; className?: string }) {
  if (src) return <img src={src} alt="" className={cn("object-cover", className)} />;
  const h = hashHue(seed);
  return (
    <div
      aria-hidden
      className={className}
      style={{
        background: `radial-gradient(circle at 30% 35%, hsl(${(h + 40) % 360} 85% 65%), transparent 55%), linear-gradient(135deg, hsl(${h} 55% 28%), hsl(${(h + 25) % 360} 65% 45%))`,
      }}
    />
  );
}
