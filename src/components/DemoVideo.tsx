"use client";

import { useEffect, useRef } from "react";
import { pickInk } from "@/components/RubiksCube";
import { withBasePath } from "@/lib/site";

/**
 * A short, silent, looping screen recording from `public/instructions/`
 * (made by `scripts/demos/record.mts`). It behaves like a GIF at a fraction
 * of the size: it only downloads once scrolled near, plays only while on
 * screen, and for people who ask for reduced motion it waits for a tap on
 * play instead.
 */
export default function DemoVideo({
  name,
  step = 0,
  title,
  caption,
  sticker = "#3f3f46",
}: {
  /** File name without extension: `<name>.webm`, `.mp4` and `.jpg`. */
  name: string;
  step: number;
  title: string;
  caption: string;
  /** The step badge's colour, e.g. the layer's face colour. */
  sticker?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.controls = true;
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.preload = "auto";
          video.play().catch(() => {
            // Autoplay refused (e.g. a power-saving mode): offer the button.
            video.controls = true;
          });
        } else {
          video.pause();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  const src = withBasePath(`/instructions/${name}`);
  return (
    <figure className="mx-auto mt-6 w-full max-w-72">
      <video
        ref={videoRef}
        muted
        loop
        playsInline
        preload="none"
        poster={`${src}.jpg`}
        aria-label={`${step}. ${title}: ${caption}`}
        className="w-full rounded-2xl border border-white/10 bg-black"
        style={{ aspectRatio: "390 / 844" }}
      >
        <source src={`${src}.webm`} type="video/webm" />
        <source src={`${src}.mp4`} type="video/mp4" />
      </video>
      <figcaption className="mt-3 flex gap-3 text-[15px] leading-6 text-zinc-300">
        {step > 0 && (
          <span
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm font-bold ring-1 ring-white/15"
            style={{ background: sticker, color: pickInk(sticker) }}
          >
            {step}
          </span>
        )}
        <span>
          <b className="font-semibold text-white">{title}:</b> {caption}
        </span>
      </figcaption>
    </figure>
  );
}
