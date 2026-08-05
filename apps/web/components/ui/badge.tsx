import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-semibold tracking-wide",
  {
    variants: {
      variant: {
        default: "bg-[#ff4d9a]/18 text-[#ff9ec8] shadow-[0_0_12px_rgba(255,77,154,0.2)]",
        verified: "bg-[#5dffc2]/15 text-[#5dffc2]",
        live: "bg-[#4de8ff]/15 text-[#4de8ff]",
        catalog: "bg-white/8 text-[#b7a8c9]",
        locked: "bg-[#a78bfa]/18 text-[#c4b5fd]",
        stale: "bg-[#ffb454]/15 text-[#ffb454]",
        muted: "bg-white/5 text-[#b7a8c9]",
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
