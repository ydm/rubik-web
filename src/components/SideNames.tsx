"use client";

import type { FaceKey } from "@/components/RubiksCube";
import { FACE_CODE, schemeColors, useFaceScheme } from "@/lib/faceColours";

/** The six faces, with the initial of their Bulgarian name split off. */
const SIDES: { letter: string; rest: string; face: FaceKey }[] = [
  { letter: "П", rest: "редна", face: "F" },
  { letter: "З", rest: "адна", face: "B" },
  { letter: "Л", rest: "ява", face: "L" },
  { letter: "Д", rest: "ясна", face: "R" },
  { letter: "Г", rest: "орна", face: "U" },
  { letter: "О", rest: "сновна", face: "D" },
];

/**
 * "Предна, Задна, Лява, Дясна, Горна и Основна", inline, each initial in bold
 * and tinted the colour the player gave that face — the letters the cube's
 * centres and the move notation use.
 */
export default function SideNames() {
  const colors = schemeColors(useFaceScheme());
  return (
    <>
      {SIDES.map((s, i) => (
        <span key={s.face}>
          <b style={{ color: colors[FACE_CODE[s.face]] }}>{s.letter}</b>
          {s.rest}
          {i < SIDES.length - 2 ? ", " : i === SIDES.length - 2 ? " и " : ""}
        </span>
      ))}
    </>
  );
}
