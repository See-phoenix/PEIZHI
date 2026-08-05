import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold tracking-wide",
  {
    variants: {
      variant: {
        default: "bg-[var(--color-copper)]/15 text-[var(--color-copper-bright)]",
        verified: "bg-[var(--color-solder)]/15 text-[var(--color-solder)]",
        live: "bg-[var(--color-voltage)]/15 text-[var(--color-voltage)]",
        catalog: "bg-white/5 text-[var(--color-mute)]",
        locked: "bg-[var(--color-aluminum)]/10 text-[var(--color-aluminum)]",
        stale: "bg-[var(--color-warn)]/15 text-[var(--color-warn)]",
        muted: "bg-white/5 text-[var(--color-mute)]",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
