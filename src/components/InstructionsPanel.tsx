"use client";

import DemoVideo from "@/components/DemoVideo";
import { FACE_LABELS, pickInk, type FaceKey } from "@/components/RubiksCube";
import SideNames from "@/components/SideNames";
import StepBox from "@/components/StepBox";
import {
  DEFAULT_SCHEME,
  FACE_COLOUR_OPTIONS,
  saveFaceScheme,
  schemeColors,
  useFaceScheme,
  withFaceColour,
} from "@/lib/faceColours";
import type { ReactNode } from "react";

/** The faces in settings order, with their Bulgarian names. */
const FACES: { face: FaceKey; name: string }[] = [
  { face: "R", name: "Дясна" },
  { face: "L", name: "Лява" },
  { face: "U", name: "Горна" },
  { face: "D", name: "Основна" },
  { face: "F", name: "Предна" },
  { face: "B", name: "Задна" },
];

const HEX = Object.fromEntries(FACE_COLOUR_OPTIONS.map((o) => [o.id, o.hex]));

/** The project's source code, shown in the Лиценз section. A repository with
 *  no `url` yet is listed without a link. */
const REPOSITORIES: { name: string; url: string }[] = [
  { name: "Уеб приложение", url: "https://github.com/ydm/rubik-web" },
  {
    name: "Нареждаща програма (Rust)",
    url: "https://github.com/ydm/rubik-solver",
  },
];

const MIT_LICENSE_URL = "https://opensource.org/license/mit";

/** Color of the middle layer. */
const MIDDLE = "#00923f";

const linkClass =
  "font-medium text-sky-400 underline decoration-sky-400/40 underline-offset-4 active:text-sky-300";

/** One section of the tab: a card with a sticker-marked heading. */
function Card({
  id,
  title,
  sticker,
  children,
}: {
  id: string;
  title: ReactNode;
  sticker: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5"
    >
      <h2
        id={id}
        className="flex items-center gap-3 text-xl font-semibold tracking-tight text-white"
      >
        <span
          aria-hidden="true"
          className="h-4 w-4 shrink-0 rounded-sm ring-1 ring-white/20"
          style={{ background: sticker }}
        />
        {title}
      </h2>
      {children}
    </section>
  );
}

/** A bulleted list whose markers are small stickers, cycling the colours. */
function StickerList({
  colors,
  items,
}: {
  colors: string[];
  items: ReactNode[];
}) {
  return (
    <ul className="mt-4 flex flex-col gap-3.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span
            aria-hidden="true"
            className="mt-[0.6rem] h-2.5 w-2.5 shrink-0 rounded-[3px]"
            style={{ background: colors[i % colors.length] }}
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** The Инструкции tab: how to use the app, then the settings. Its title is
 *  in the page header. */
export default function InstructionsPanel() {
  const scheme = useFaceScheme();
  const colors = schemeColors(scheme);
  const isDefault = FACES.every(
    ({ face }) => scheme[face] === DEFAULT_SCHEME[face],
  );
  const white = colors.W;
  const yellow = colors.Y;
  const bullets = ["R", "G", "B", "O", "Y", "W"].map((c) => colors[c]);

  /** The beginner's method, in order, each with its layer's colour. */
  const method: { name: string; sticker: string }[] = [
    { name: "бял кръст", sticker: white },
    { name: "бели ъгли", sticker: white },
    { name: "среден слой", sticker: MIDDLE },
    { name: "жълт кръст", sticker: yellow },
    { name: "жълти ъгли", sticker: yellow },
  ];

  return (
    <div className="h-full w-full touch-pan-y overflow-y-auto overscroll-contain">
      <article className="mx-auto flex max-w-xl flex-col gap-5 px-3 pb-12 pt-4 text-base leading-7 text-zinc-300">
        <Card id="solve-heading" title={<>Раздел „Нареди“</>} sticker={white}>
          <StickerList
            colors={bullets}
            items={[
              <>
                Тук оцветяваш лицата така, както изглежда твоят собствен куб, и
                получаваш ходовете, с които да го наредиш.
              </>,
              <>
                Оцветяването може да е частично, а подредените вече лица не се
                разместват.
              </>,
              <>
                Страните са <SideNames />. Ако твоят куб има различни цветове,
                отиди в{" "}
                <a href="#settings-heading" className={linkClass}>
                  настройките
                </a>{" "}
                и промени цветовете на страните.
              </>,
              <>
                В решението <StepBox>Д</StepBox> означава завъртане на дясната
                страна по часовниковата стрелка, а завъртане в обратната посока
                се отбелязва с&nbsp;<StepBox>Д&apos;</StepBox>.
              </>,
              <>
                Използвай раздела, за да научиш, разбереш и запомниш оптималните
                формули за всяка ситуация.
              </>,
              <>
                Ако си начинаещ и тепърва учиш куба на Рубик, препоръчваме
                следната последователност:
              </>,
            ]}
          />

          <ol className="mt-4 flex flex-wrap items-center gap-x-1.5 gap-y-2 text-[15px] font-semibold text-zinc-100">
            {method.map(({ name, sticker }, i) => (
              <li key={name} className="flex items-center gap-1.5">
                <span className="flex items-center gap-2 rounded-full border border-white/15 bg-zinc-800/80 py-1 pl-1.5 pr-3">
                  <span
                    aria-hidden="true"
                    className="flex h-5 w-5 items-center justify-center rounded-sm text-xs font-bold"
                    style={{ background: sticker, color: pickInk(sticker) }}
                  >
                    {i + 1}
                  </span>
                  {name}
                </span>
                {i < method.length - 1 && (
                  <span aria-hidden="true" className="text-zinc-500">
                    →
                  </span>
                )}
              </li>
            ))}
          </ol>

          <p className="mt-5">Виж примерите:</p>

          <DemoVideo
            name="white-cross"
            step={1}
            sticker={white}
            title="Бял кръст"
            caption="оцвети лицата на четирите бели ръба и натисни бутона „Нареди“"
          />
          <DemoVideo
            name="white-corners"
            step={2}
            sticker={white}
            title="Бели ъгли"
            caption="оцвети лицата на четирите бели ъгъла"
          />
          <DemoVideo
            name="middle-edges"
            step={3}
            sticker={MIDDLE}
            title="Среден слой"
            caption="оцвети лицата на четирите средни ръба"
          />
          <DemoVideo
            name="yellow-cross"
            step={4}
            sticker={yellow}
            title="Жълт кръст"
            caption="оцвети четирите жълти ръба"
          />
          <DemoVideo
            name="yellow-corners"
            step={5}
            sticker={yellow}
            title="Жълти ъгли"
            caption="оцвети лицата на последните четири блокчета"
          />

          <p className="mt-6 rounded-xl border border-sky-400/20 bg-sky-400/5 px-4 py-3 text-zinc-200">
            Всяка една от тези стъпки може да се прави и поотделно, например
            блокче по блокче.
          </p>
        </Card>

        <Card
          id="mission-heading"
          title={<>Раздел „Мисия“</>}
          sticker={colors.R}
        >
          <p className="mt-3">
            В раздел „<b className="text-white">Мисия</b>“ всеки ден получаваш
            нов разбъркан куб. Задачата ти е да го наредиш без чужда помощ.
          </p>
        </Card>

        <Card id="settings-heading" title="Настройки" sticker={colors.G}>
          <h3 className="mt-4 text-lg font-semibold text-zinc-100">
            Цветове на страните
          </h3>
          <p className="mt-1">
            Някои кубове са оцветени различно. Избери цвета на всяка страна, за
            да съвпада с твоя куб. Ако избереш цвят, който вече има друга
            страна, двете си разменят цветовете.
          </p>

          <ul className="mt-5 flex flex-col gap-5">
            {FACES.map(({ face, name }) => {
              const hex = HEX[scheme[face]];
              return (
                <li key={face} className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-2.5">
                    {/* Looks like the face's centre sticker. */}
                    <span
                      aria-hidden="true"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-sm font-bold"
                      style={{ background: hex, color: pickInk(hex) }}
                    >
                      {FACE_LABELS.bg[face]}
                    </span>
                    <span
                      id={`face-${face}`}
                      className="font-medium text-zinc-100"
                    >
                      {name} страна
                    </span>
                  </div>
                  <div
                    role="radiogroup"
                    aria-labelledby={`face-${face}`}
                    className="flex flex-wrap gap-2.5"
                  >
                    {FACE_COLOUR_OPTIONS.map((option) => {
                      const selected = scheme[face] === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          aria-label={option.name}
                          title={option.name}
                          onClick={() =>
                            saveFaceScheme(
                              withFaceColour(scheme, face, option.id),
                            )
                          }
                          className={`h-10 w-10 rounded-lg border-2 transition-transform ${
                            selected
                              ? "scale-110 border-white"
                              : "border-black/30 active:scale-95"
                          }`}
                          style={{ background: option.hex }}
                        />
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            disabled={isDefault}
            onClick={() => saveFaceScheme(DEFAULT_SCHEME)}
            className="mt-7 rounded-full border border-white/25 px-5 py-2 text-[15px] font-medium text-zinc-100 active:bg-white/10 disabled:opacity-40"
          >
            Стандартни цветове
          </button>
        </Card>

        <Card id="license-heading" title="Лиценз" sticker={colors.B}>
          <p className="mt-3">
            Този проект е свободен софтуер с отворен код, разпространяван
            под&nbsp;
            <a
              href={MIT_LICENSE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              лиценза MIT
            </a>
            . Можеш свободно да го използваш, променяш и споделяш.
          </p>
          <p className="mt-3">
            Направен е с любов за всички, които учат кубчето на Рубик.
          </p>
          <p className="mt-3">Сорс кодът е в GitHub:</p>
          <StickerList
            colors={[colors.O, colors.G]}
            items={REPOSITORIES.map(({ name, url }) => (
              <a
                key={name}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                {name}
              </a>
            ))}
          />
          <p className="mt-4">
            За бъгове, обратна връзка и предложения за подобрения:&nbsp;
            <a
              href="https://github.com/ydm/rubik-web/issues"
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              клик
            </a>
            .
          </p>
        </Card>
      </article>
    </div>
  );
}
