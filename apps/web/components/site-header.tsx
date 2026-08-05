"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cpu, Server } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedShinyText } from "@/components/magicui/animated-shiny-text";

const NAV = [
  { href: "/", label: "装机配置", icon: Cpu },
  { href: "/servers", label: "服务器选型", icon: Server },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/75 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center justify-between px-4 sm:px-6">
        <Link href="/" className="group flex items-baseline gap-2 no-underline">
          <AnimatedShinyText className="font-[family-name:var(--font-display)] text-lg font-bold tracking-[0.12em] !bg-clip-text">
            PEIZHI
          </AnimatedShinyText>
          <span className="text-xs font-medium tracking-[0.2em] text-slate-500">配智</span>
        </Link>
        <nav className="flex items-center gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm no-underline transition",
                  active
                    ? "bg-cyan-400/10 text-cyan-200"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
