import * as React from "react";
import { cn } from "@/lib/utils";

const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  ({ className, children, ...props }, ref) => (
    <select
      className={cn(
        "flex h-10 w-full appearance-none rounded-xl border border-white/12 bg-[#0b0614]/55 bg-[length:12px] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-8 text-sm text-[#f4eef8] outline-none transition focus:border-[#4de8ff]/50 focus:ring-2 focus:ring-[#4de8ff]/20 disabled:cursor-not-allowed disabled:opacity-50",
        "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 fill=%22none%22 stroke=%22%23b7a8c9%22 stroke-width=%222%22%3E%3Cpath d=%22m2 4 4 4 4-4%22/%3E%3C/svg%3E')]",
        className
      )}
      ref={ref}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = "Select";

export { Select };
