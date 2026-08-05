"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "装机" },
  { href: "/servers", label: "云主机" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-edge)]/70 bg-[var(--color-bay)]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1380px] items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-3 no-underline">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-md border border-[var(--color-copper)]/40 bg-[var(--color-rail)]">
            <svg viewBox="0 0 32 32" className="h-5 w-5" aria-hidden>
              <path
                d="M6 10h8v4H10v8H6V10zm12 0h8v12h-4v-8h-4V10z"
                fill="none"
                stroke="var(--color-copper-bright)"
                strokeWidth="1.6"
                className="origin-center transition group-hover:stroke-[var(--color-voltage)]"
              />
              <circle cx="10" cy="12" r="1.2" fill="var(--color-voltage)" />
              <circle cx="22" cy="20" r="1.2" fill="var(--color-solder)" />
            </svg>
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-[family-name:var(--font-display)] text-[1.35rem] font-extrabold tracking-[0.14em] text-[var(--color-ink)]">
              PEIZHI
            </span>
            <span className="mt-1 text-[11px] font-medium tracking-[0.28em] text-[var(--color-copper)]">
              配智 · 配件台
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 rounded-lg border border-[var(--color-edge)] bg-[var(--color-rail)]/80 p-1">
          {NAV.map(({ href, label }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "rounded-md px-3.5 py-1.5 text-sm no-underline transition",
                  active
                    ? "bg-[var(--color-copper)]/20 text-[var(--color-voltage)]"
                    : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="copper-rule" />
    </header>
  );
}
