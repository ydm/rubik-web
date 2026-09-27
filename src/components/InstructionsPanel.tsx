"use client";

import DemoVideo from "@/components/DemoVideo";
import { FACE_LABELS, pickInk, type FaceKey } from "@/components/RubiksCube";
import SideNames from "@/components/SideNames";
import {
  DEFAULT_SCHEME,
  FACE_COLOUR_OPTIONS,
  saveFaceScheme,
  useFaceScheme,
  withFaceColour,
} from "@/lib/faceColours";
import { stepBoxClass } from "@/components/StepBox";

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

/** The Инструкции tab: how to use the app, then the settings. */
export default function InstructionsPanel() {
  const scheme = useFaceScheme();
  const isDefault = FACES.every(
    ({ face }) => scheme[face] === DEFAULT_SCHEME[face],
  );

  return (
    <div className="h-full w-full touch-pan-y overflow-y-auto overscroll-contain">
      <article className="mx-auto max-w-xl px-4 pb-10 pt-6 text-sm leading-6 text-zinc-300">
        <section aria-labelledby="instructions-heading">
          <h2
            id="instructions-heading"
            className="text-xl font-semibold text-white"
          >
            Инструкции
          </h2>
          <h3 className="mt-4 font-semibold text-zinc-100">
            Раздел „<b>Нареди</b>“
          </h3>
          <p className="mt-3">
            • Тук оцветяваш лицата така, както изглежда твоят собствен куб, и
            получаваш ходовете, с които да го наредиш.
          </p>
          <p className="mt-3">
            • Оцветяването може да е частично, а подредените вече лица не се
            разместват.
          </p>

          <p className="mt-3">
            • Страните са <SideNames />. Ако твоят куб има различни цветове,
            отиди в настройките и промени цветовете на страните.
          </p>

          <p className="mt-3">
            • В решението
            <>
              &nbsp;
              <a type="button" className={`font-mono ${stepBoxClass(false)}`}>
                Д
              </a>
              &nbsp;
            </>
            означава завъртане на дясната страна по часовниковата стрелка, а
            завъртане в обратната посока се отбелязва с
            <>
              &nbsp;
              <a type="button" className={`font-mono ${stepBoxClass(false)}`}>
                Д&apos;
              </a>
            </>
            .
          </p>

          <p className="mt-3">
            • Използвай раздела, за да научиш, разбереш и запомниш оптималните
            формули за всяка ситуация.
          </p>

          <p className="mt-3">
            • Ако си начинаещ и тепърва учиш куба на Рубик, препоръчваме
            следната последователност:
            <>
              &nbsp;
              <span className="font-semibold text-zinc-100">
                бял кръст → бели ъгли → среден слой → жълт кръст → жълти ъгли
              </span>
            </>
            . Виж примерите:
          </p>

          <DemoVideo
            name="white-cross"
            caption="1. Бял кръст: оцвети лицата на четирите бели ръба и натисни бутона „Нареди“"
          />

          <DemoVideo
            name="white-corners"
            caption="2. Бели ъгли: оцвети лицата на четирите бели ъгъла"
          />

          <DemoVideo
            name="middle-edges"
            caption="3. Среден слой: оцвети лицата на четирите средни ръба"
          />

          <DemoVideo
            name="yellow-cross"
            caption="4. Жълт кръст: оцвети четирите жълти ръба"
          />

          <DemoVideo
            name="yellow-corners"
            caption="5: Жълти ъгли: оцвети лицата на последните четири блокчета"
          />

          <p className="mt-3">
            • Всяка една от тези стъпки може да се прави и поотделно – блокче
            след блокче.
          </p>

          <h3 className="mt-4 font-semibold text-zinc-100">
            Раздел „<b>Мисия</b>“
          </h3>
          <p className="mt-3">
            В раздел „<b>Мисия</b>“ всеки ден получаваш нов разбъркан куб.
            Задачата ти е да го нареди без чужда помощ.
          </p>
        </section>

        <br />
        <hr />

        <section aria-labelledby="settings-heading" className="mt-10">
          <h2
            id="settings-heading"
            className="text-xl font-semibold text-white"
          >
            Настройки
          </h2>

          <h3 className="mt-4 font-semibold text-zinc-100">
            Цветове на страните
          </h3>
          <p className="mt-1 text-zinc-400">
            Някои кубове са оцветени различно. Избери цвета на всяка страна, за
            да съвпада с твоя куб. Ако избереш цвят, който вече има друга
            страна, двете си разменят цветовете.
          </p>

          <ul className="mt-4 flex flex-col gap-4">
            {FACES.map(({ face, name }) => {
              const hex = HEX[scheme[face]];
              return (
                <li key={face} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    {/* Looks like the face's centre sticker. */}
                    <span
                      aria-hidden="true"
                      className="flex h-6 w-6 items-center justify-center rounded text-xs font-bold"
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
                    className="flex flex-wrap gap-2"
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
                          className={`h-8 w-8 rounded-md border-2 transition-transform ${
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
            className="mt-6 rounded-full border border-white/20 px-4 py-1.5 text-sm font-medium text-zinc-200 active:bg-white/10 disabled:opacity-40"
          >
            Стандартни цветове
          </button>
        </section>

        <br />
        <hr />

        <section aria-labelledby="license-heading" className="mt-10">
          <h2 id="license-heading" className="text-xl font-semibold text-white">
            Лиценз
          </h2>
          <p className="mt-3">
            Този проект е свободен софтуер с отворен код, разпространяван под
            <>
              &nbsp;
              <a
                href={MIT_LICENSE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-400 underline underline-offset-2"
              >
                лиценза MIT
              </a>
            </>
            . Можеш свободно да го използваш, променяш и споделяш.
          </p>
          <p className="mt-3">
            Направен е с любов за всички, които учат кубчето на Рубик.
          </p>
          <p className="mt-3">Сорс кодът е в GitHub:</p>
          <ul className="mt-2 list-disc pl-5">
            {REPOSITORIES.map(({ name, url }) => (
              <li key={name}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 underline underline-offset-2"
                >
                  {name}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-3">
            За бъгове, обратна връзка и предложения за подобрения:
            <>
              &nbsp;
              <a
                href="https://github.com/ydm/rubik-web/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-400 underline underline-offset-2"
              >
                клик
              </a>
            </>
            .
          </p>
        </section>
      </article>
    </div>
  );
}
