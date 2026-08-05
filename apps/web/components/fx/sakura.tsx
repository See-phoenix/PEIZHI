"use client";

import { useEffect, useRef } from "react";
import { animate } from "animejs";
import { prefersReducedMotion } from "@/lib/motion";

type Petal = {
  x: number;
  y: number;
  r: number;
  s: number;
  rot: number;
  vx: number;
  vy: number;
  vr: number;
  color: string;
};

/**
 * Canvas sakura / neon petal field + anime.js v4 bubble sway.
 */
export function SakuraField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const decoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let raf = 0;
    let running = true;

    const colors = ["#ff7eb3", "#ff4d9a", "#ffa6d0", "#c4b5fd", "#7dd3fc"];
    const petals: Petal[] = Array.from({ length: 28 }, () => ({
      x: Math.random() * 1000,
      y: Math.random() * 800,
      r: 4 + Math.random() * 6,
      s: 0.6 + Math.random() * 0.8,
      rot: Math.random() * Math.PI * 2,
      vx: -0.35 - Math.random() * 0.55,
      vy: 0.45 + Math.random() * 0.85,
      vr: (Math.random() - 0.5) * 0.04,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio, 1.5);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const drawPetal = (p: Petal) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(p.s, p.s);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(p.r, -p.r * 0.6, 0, -p.r * 1.6);
      ctx.quadraticCurveTo(-p.r, -p.r * 0.6, 0, 0);
      ctx.fill();
      ctx.restore();
    };

    const tick = () => {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      ctx.clearRect(0, 0, w, h);
      for (const p of petals) {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        if (p.y > h + 20) {
          p.y = -20;
          p.x = Math.random() * w;
        }
        if (p.x < -20) p.x = w + 20;
        drawPetal(p);
      }
    };

    resize();
    tick();
    window.addEventListener("resize", resize);

    // Soft bubble sway — per-node timelines (anime.js v4 delay typings are strict)
    const sways: Array<ReturnType<typeof animate>> = [];
    if (decoRef.current) {
      decoRef.current.querySelectorAll("[data-bubble]").forEach((node, i) => {
        sways.push(
          animate(node, {
            translateY: [{ to: -18 }, { to: 0 }],
            opacity: [{ to: 0.75 }, { to: 0.35 }],
            duration: 2800,
            loop: true,
            ease: "inOutSine",
            delay: i * 220,
          })
        );
      });
    }

    const onVis = () => {
      running = document.visibilityState === "visible";
      if (running) tick();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
      sways.forEach((s) => s.pause());
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[1] opacity-70"
      />
      <div ref={decoRef} aria-hidden className="pointer-events-none fixed inset-0 z-[1] overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <span
            key={i}
            data-bubble
            className="absolute rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.55),rgba(77,232,255,0.15)_45%,transparent_70%)]"
            style={{
              width: 10 + (i % 4) * 8,
              height: 10 + (i % 4) * 8,
              left: `${8 + i * 11}%`,
              bottom: `${6 + (i % 5) * 12}%`,
              filter: "blur(0.2px)",
            }}
          />
        ))}
      </div>
    </>
  );
}
