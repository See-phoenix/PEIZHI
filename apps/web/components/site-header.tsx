"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "装机台" },
  { href: "/servers", label: "云主机" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b0614]/55 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1380px] items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-3 no-underline">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[#ff4d9a]/40 bg-[#160d24] shadow-[0_0_18px_rgba(255,77,154,0.35)]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#4de8ff] shadow-[0_0_10px_#4de8ff]" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-[family-name:var(--font-display)] text-lg font-extrabold tracking-[0.16em] text-white neon-text">
              PEIZHI
            </span>
            <span className="mt-1 text-[11px] font-medium tracking-[0.22em] text-[#ff7eb3]">
              配智 · ACG DESK
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1 backdrop-blur-md">
          {NAV.map(({ href, label }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 text-sm no-underline transition",
                  active
                    ? "bg-gradient-to-r from-[#ff4d9a]/30 to-[#4de8ff]/20 text-white shadow-[0_0_16px_rgba(255,77,154,0.25)]"
                    : "text-[#b7a8c9] hover:text-white"
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="neon-rule" />
    </header>
  );
}
