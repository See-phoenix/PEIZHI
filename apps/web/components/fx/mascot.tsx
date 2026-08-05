"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * Lightweight CSS/SVG 看板娘 stand-in (no Live2D asset dependency).
 * Idle bob + blink via GSAP; pointer parallax on the figure.
 */
export function MascotBadge() {
  const rootRef = useRef<HTMLDivElement>(null);
  const figureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const root = rootRef.current;
    const figure = figureRef.current;
    if (!root || !figure) return;

    const bob = gsap.to(figure, {
      y: -8,
      duration: 1.8,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut",
    });

    const blink = gsap.timeline({ repeat: -1, repeatDelay: 2.4 });
    blink
      .to("[data-eye]", { scaleY: 0.12, duration: 0.08, transformOrigin: "center" }, 0)
      .to("[data-eye]", { scaleY: 1, duration: 0.1 }, 0.1);

    const onMove = (e: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      gsap.to(figure, {
        rotateY: nx * 14,
        rotateX: -ny * 10,
        duration: 0.5,
        ease: "power2.out",
      });
    };

    root.addEventListener("pointermove", onMove);
    return () => {
      bob.kill();
      blink.kill();
      root.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="pointer-events-auto absolute -right-2 bottom-2 z-20 hidden w-[132px] perspective-[800px] sm:block lg:w-[150px]"
      aria-hidden
    >
      <div
        ref={figureRef}
        className="relative preserve-3d rounded-2xl border border-white/15 bg-gradient-to-b from-[#2a1540]/90 to-[#12081f]/95 p-3 shadow-[0_0_30px_rgba(255,77,154,0.35)] backdrop-blur-md"
        style={{ transformStyle: "preserve-3d" }}
      >
        <p className="mb-2 text-center text-[10px] font-semibold tracking-[0.18em] text-[#ff7eb3]">
          配智酱
        </p>
        <svg viewBox="0 0 120 140" className="mx-auto h-[110px] w-auto drop-shadow-[0_0_12px_rgba(77,232,255,0.35)]">
          {/* hair */}
          <path
            d="M28 58c2-28 22-42 32-42s30 14 32 42c8 2 14 14 10 24-8-6-16-8-20-8-2 18-12 28-22 28s-20-10-22-28c-4 0-12 2-20 8-4-10 2-22 10-24z"
            fill="#ff4d9a"
          />
          <path d="M34 62c4-18 16-28 26-28s22 10 26 28" fill="#ff9ec8" opacity="0.55" />
          {/* face */}
          <ellipse cx="60" cy="78" rx="26" ry="28" fill="#ffe8f2" />
          {/* eyes */}
          <ellipse data-eye cx="50" cy="78" rx="5" ry="7" fill="#2a1540" />
          <ellipse data-eye cx="70" cy="78" rx="5" ry="7" fill="#2a1540" />
          <circle cx="52" cy="76" r="1.6" fill="#fff" />
          <circle cx="72" cy="76" r="1.6" fill="#fff" />
          {/* blush */}
          <ellipse cx="42" cy="88" rx="5" ry="3" fill="#ff7eb3" opacity="0.45" />
          <ellipse cx="78" cy="88" rx="5" ry="3" fill="#ff7eb3" opacity="0.45" />
          {/* mouth */}
          <path d="M55 94c3 4 7 4 10 0" fill="none" stroke="#ff4d9a" strokeWidth="2" strokeLinecap="round" />
          {/* body / hoodie */}
          <path d="M40 108c6 10 14 16 20 16s14-6 20-16c-8 4-32 4-40 0z" fill="#4de8ff" opacity="0.85" />
          <path d="M48 112h24v6H48z" fill="#a78bfa" />
          {/* antenna LED */}
          <circle cx="86" cy="42" r="4" fill="#4de8ff">
            <animate attributeName="opacity" values="1;0.4;1" dur="1.6s" repeatCount="indefinite" />
          </circle>
        </svg>
        <p className="mt-1 text-center text-[10px] text-[#c4b5fd]">一起配一台！</p>
      </div>
    </div>
  );
}
