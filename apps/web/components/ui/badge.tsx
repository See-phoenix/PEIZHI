import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide",
  {
    variants: {
      variant: {
        default: "bg-cyan-400/15 text-cyan-200",
        verified: "bg-emerald-400/15 text-emerald-300",
        live: "bg-amber-400/15 text-amber-200",
        catalog: "bg-slate-400/15 text-slate-300",
        locked: "bg-sky-400/15 text-sky-200",
        stale: "bg-orange-400/15 text-orange-200",
        muted: "bg-white/5 text-slate-400",
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
