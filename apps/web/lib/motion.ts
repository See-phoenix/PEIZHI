"use client";

import gsap from "gsap";

/** Respect OS reduced-motion; gate heavy FX. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function createPageTimeline(scope: HTMLElement | null) {
  if (!scope || prefersReducedMotion()) return null;
  const ctx = gsap.context(() => {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.fromTo(
      "[data-anim='hero']",
      { y: 36, opacity: 0, filter: "blur(8px)" },
      { y: 0, opacity: 1, filter: "blur(0px)", duration: 0.85 },
      0.05
    )
      .fromTo(
        "[data-anim='panel']",
        { y: 48, opacity: 0, rotateX: 8 },
        {
          y: 0,
          opacity: 1,
          rotateX: 0,
          duration: 0.7,
          stagger: 0.12,
          clearProps: "filter",
        },
        0.2
      )
      .fromTo(
        "[data-anim='item']",
        { y: 18, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.45, stagger: 0.045 },
        0.45
      );
  }, scope);
  return ctx;
}

export function hoverLift(el: HTMLElement | null, strength = 1) {
  if (!el || prefersReducedMotion()) return () => undefined;
  const enter = () =>
    gsap.to(el, {
      y: -6 * strength,
      scale: 1.015,
      boxShadow: "0 18px 40px rgba(255, 77, 154, 0.22)",
      duration: 0.35,
      ease: "power2.out",
    });
  const leave = () =>
    gsap.to(el, {
      y: 0,
      scale: 1,
      boxShadow: "0 8px 24px rgba(0, 0, 0, 0.25)",
      duration: 0.4,
      ease: "power2.out",
    });
  el.addEventListener("pointerenter", enter);
  el.addEventListener("pointerleave", leave);
  return () => {
    el.removeEventListener("pointerenter", enter);
    el.removeEventListener("pointerleave", leave);
  };
}
