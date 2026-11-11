/* eslint-disable @next/next/no-img-element */
import { cn, hashHue, initials } from "@/lib/utils";

const sizes = { xs: "h-5 w-5 text-[9px]", sm: "h-8 w-8 text-xs", md: "h-11 w-11 text-base", lg: "h-16 w-16 text-xl", xl: "h-24 w-24 text-3xl" };

export function Avatar({
  name,
  src,
  size = "sm",
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const cls = cn("shrink-0 rounded-full object-cover", sizes[size], className);
  if (src) return <img src={src} alt="" className={cls} />;
  const hue = hashHue(name);
  return (
    <span
      aria-hidden
      className={cn(cls, "grid place-items-center font-semibold text-white")}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 40) % 360} 65% 35%))` }}
    >
      {initials(name)}
    </span>
  );
}
