"use client";

import { StarfieldCanvas } from "@/components/fx/starfield";
import { SakuraField } from "@/components/fx/sakura";

/** Shared immersive atmosphere for product desks. */
export function PageAtmosphere() {
  return (
    <>
      <StarfieldCanvas />
      <SakuraField />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[2] bg-[radial-gradient(ellipse_at_top,rgba(255,77,154,0.14),transparent_42%),radial-gradient(ellipse_at_bottom_right,rgba(77,232,255,0.1),transparent_40%)]"
      />
    </>
  );
}
