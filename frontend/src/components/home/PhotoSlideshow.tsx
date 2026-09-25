"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils/cn";

export type PhotoSlideshowProps = {
  images: string[];
  /** Describes the set once; the other slides are decorative to a screen reader. */
  alt: string;
  sizes: string;
  /** Milliseconds each photo holds before the next one fades in. */
  intervalMs?: number;
  fadeMs?: number;
  /**
   * Overrides the optimizer's default 75. Worth raising for a full-bleed
   * panel: at that size 75 puts visible blocking into skin tones and flat
   * studio backdrops, which is exactly what these photographs are made of.
   * Must be listed in `images.qualities` in next.config.ts.
   */
  quality?: number;
  /** "gentle" keeps the drift to 1.06 where the source cannot spare the pixels. */
  drift?: "full" | "gentle";
  className?: string;
};

/**
 * Cross-fading background photos with a slow Ken Burns zoom, matching the
 * original's Elementor slideshow: 4s per slide, a 2s fade, and the active
 * photo scaling to 1.3 over 20 seconds.
 *
 * Like Swiper's fade effect, only the incoming photo animates: the one it
 * replaces stays fully opaque underneath it. Fading both at once would dip
 * through a washed-out middle where neither covers the panel.
 */
export function PhotoSlideshow({
  images,
  alt,
  sizes,
  intervalMs = 4000,
  fadeMs = 2000,
  quality,
  drift = "full",
  className,
}: PhotoSlideshowProps) {
  // -1 until the first advance, so nothing sits behind the opening photo.
  const [{ index, previous }, setSlide] = useState({ index: 0, previous: -1 });

  useEffect(() => {
    if (images.length < 2) return;
    // Someone who asked for less motion gets the first photo, held still.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(
      () =>
        setSlide((current) => ({
          index: (current.index + 1) % images.length,
          previous: current.index,
        })),
      intervalMs,
    );

    return () => window.clearInterval(timer);
  }, [images.length, intervalMs]);

  return (
    // isolate: the slides stack against each other only. Without it their
    // z-indexes escape and paint over whatever the caller lays on top.
    <div className={cn("absolute inset-0 isolate overflow-hidden", className)}>
      {images.map((src, position) => {
        const isActive = position === index;
        const isOutgoing = position === previous;

        return (
          <div
            key={src}
            className="absolute inset-0"
            style={{
              opacity: isActive || isOutgoing ? 1 : 0,
              zIndex: isActive ? 2 : isOutgoing ? 1 : 0,
              // Only the photo coming in animates; the rest switch instantly,
              // hidden behind it.
              transition: isActive ? `opacity ${fadeMs}ms ease` : "none",
            }}
          >
            <Image
              src={src}
              alt={position === 0 ? alt : ""}
              fill
              sizes={sizes}
              quality={quality}
              // Only the first slide blocks paint; the rest arrive before their turn.
              priority={position === 0}
              data-active={isActive}
              className={cn(
                "ken-burns object-cover",
                drift === "gentle" && "ken-burns-gentle",
              )}
            />
          </div>
        );
      })}
    </div>
  );
}
