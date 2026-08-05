"use client";

import { useEffect, useRef } from "react";
import { createPageTimeline } from "@/lib/motion";

/** Mounts GSAP entrance timeline for children marked with data-anim. */
export function MotionStage({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = createPageTimeline(ref.current);
    return () => ctx?.revert();
  }, []);

  return (
    <div ref={ref} className={className} style={{ perspective: 1200 }}>
      {children}
    </div>
  );
}
