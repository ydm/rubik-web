import type { ComponentProps } from "react";

/** The classes of a step box: the solution trail's breadcrumbs and arrows. */
export function stepBoxClass(lit = false): string {
  return `shrink-0 rounded-md border px-2.5 py-1 text-sm font-semibold active:scale-95 ${
    lit
      ? "border-white bg-white text-black"
      : "border-white/20 bg-zinc-800 text-zinc-200"
  }`;
}

/**
 * A step box as static text, e.g. a move like "Д'" in the instructions.
 * `lit` draws it highlighted (white), like the step the cube stands on.
 */
export default function StepBox({
  lit = false,
  mono = true,
  className = "",
  ...props
}: ComponentProps<"span"> & { lit?: boolean; mono?: boolean }) {
  return (
    <span
      className={`inline-block ${mono ? "font-mono " : ""}${stepBoxClass(lit)} ${className}`}
      {...props}
    />
  );
}
