"use client";

import { useEffect, useRef, useState } from "react";

import { CloseIcon, PlayIcon } from "@/components/ui/Icons";

export type HeroVideoProps = {
  src: string;
  /** Names the clip for a screen reader, on the trigger and the dialog. */
  label: string;
};

/**
 * The hero's play control and the dialog it opens.
 *
 * The clip is 17MB, so nothing is requested until the button is pressed: the
 * <video> does not exist in the DOM before then. A click is a clear statement
 * of intent, which a page load is not — the old autoplaying background version
 * of this file cost a phone 2.7MB it never asked for.
 */
export function HeroVideo({ src, label }: HeroVideoProps) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    // The page behind must not scroll while a full-screen dialog is up.
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        className="focus-ring group grid h-16 w-16 place-items-center rounded-full border border-white/50 bg-white/15 text-white backdrop-blur-sm transition hover:scale-105 hover:bg-white/30 motion-reduce:transition-none motion-reduce:hover:scale-100 sm:h-20 sm:w-20"
      >
        {/* Nudged right: a triangle's optical centre is left of its box. */}
        <PlayIcon className="ml-0.5 h-7 w-7 sm:h-8 sm:w-8" />
      </button>

      {open && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          onClick={(event) => {
            if (event.target === dialogRef.current) setOpen(false);
          }}
          className="fixed inset-0 z-[110] grid place-items-center bg-black/85 p-4"
        >
          <button
            ref={closeRef}
            type="button"
            onClick={() => {
              setOpen(false);
              triggerRef.current?.focus();
            }}
            aria-label="Close video"
            className="focus-ring absolute top-4 right-4 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/25"
          >
            <CloseIcon className="h-6 w-6" />
          </button>

          {/* No <track>: the clip is silent b-roll with no dialogue to caption. */}
          <video
            src={src}
            autoPlay
            controls
            loop
            playsInline
            className="max-h-[80svh] w-full max-w-5xl rounded-xl"
          />
        </div>
      )}
    </>
  );
}
