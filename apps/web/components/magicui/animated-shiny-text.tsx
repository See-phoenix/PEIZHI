import { type ComponentPropsWithoutRef, type CSSProperties, type FC } from "react";
import { cn } from "@/lib/utils";

export interface AnimatedShinyTextProps extends ComponentPropsWithoutRef<"span"> {
  shimmerWidth?: number;
}

/** Magic UI Animated Shiny Text — base muted color + traveling shine. */
export const AnimatedShinyText: FC<AnimatedShinyTextProps> = ({
  children,
  className,
  shimmerWidth = 120,
  ...props
}) => {
  return (
    <span
      style={{ "--shiny-width": `${shimmerWidth}px` } as CSSProperties}
      className={cn(
        "relative inline-block text-cyan-200/80",
        "animate-shiny-text bg-clip-text bg-no-repeat",
        "bg-[linear-gradient(110deg,transparent_20%,rgba(207,250,254,0.95)_50%,transparent_80%)]",
        "bg-[length:var(--shiny-width)_100%]",
        className
      )}
      {...props}
    >
      <span className="bg-gradient-to-r from-cyan-200 via-white to-teal-200 bg-clip-text text-transparent">
        {children}
      </span>
    </span>
  );
};
