import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-xl border border-white/12 bg-[#0b0614]/55 px-3 py-2 text-sm text-[#f4eef8] placeholder:text-[#b7a8c9]/70 outline-none transition focus:border-[#ff4d9a]/50 focus:ring-2 focus:ring-[#ff4d9a]/20 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
