"use client";

import { schemeColors, useFaceScheme } from "@/lib/faceColours";

/** A scrambled-looking face, as sticker letters (see `FACE_CODE`). */
const STICKERS = ["W", "R", "G", "Y", "W", "B", "O", "G", "W"];

/**
 * A small decorative 3×3 cube face in the player's own colours, e.g. beside
 * a heading. Hidden from screen readers.
 */
export default function MiniCube({ className = "h-6 w-6" }) {
  const colors = schemeColors(useFaceScheme());
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 grid-cols-3 gap-[1.5px] rounded-[5px] bg-black p-[2px] ring-1 ring-white/15 ${className}`}
    >
      {STICKERS.map((code, i) => (
        <span
          key={i}
          className="rounded-[2px]"
          style={{ background: colors[code] }}
        />
      ))}
    </span>
  );
}
