import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-[var(--color-edge)] bg-[var(--color-bay)]/70 px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-mute)] outline-none transition focus:border-[var(--color-copper)]/50 focus:ring-2 focus:ring-[var(--color-copper)]/20 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
