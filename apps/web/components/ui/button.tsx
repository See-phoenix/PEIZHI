import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4de8ff]/60 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-[#ff4d9a] via-[#ff6bb0] to-[#4de8ff] text-[#140814] shadow-[0_0_24px_rgba(255,77,154,0.45)] hover:brightness-110 hover:shadow-[0_0_32px_rgba(77,232,255,0.4)]",
        secondary:
          "border border-white/15 bg-white/5 text-[#f4eef8] backdrop-blur-md hover:border-[#ff4d9a]/40 hover:bg-white/10",
        ghost: "text-[#b7a8c9] hover:bg-white/5 hover:text-white",
        outline:
          "border border-[#4de8ff]/40 bg-transparent text-[#4de8ff] hover:bg-[#4de8ff]/10 hover:shadow-[0_0_18px_rgba(77,232,255,0.25)]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-11 px-6 text-[15px]",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
