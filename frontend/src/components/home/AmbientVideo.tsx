"use client";

import { useEffect, useState } from "react";

export type AmbientVideoProps = {
  src: string;
  poster: string;
  className?: string;
  /** Below this width the poster stands in and the file is never requested. */
  minWidth?: number;
};

/**
 * A decorative background video that a phone never downloads.
 *
 * `hidden md:block` does not stop the download — a display:none <video> is
 * still fetched — and neither does `media` on the <source>: the attribute is
 * part of the media element's resource selection algorithm on paper, but
 * Chrome ignores it and pulled the whole file anyway. Measured on the
 * storefront's homepage that was 2.7MB of a 3.9MB mobile page, for a frame
 * the phone then hid.
 *
 * So the check happens in JavaScript, and the <source> is only ever in the DOM
 * on a viewport wide enough to show it. The first render has no source, which
 * matches the server HTML and leaves the poster on screen; a desktop adds one
 * a frame later. The poster carries the section on its own everywhere else,
 * which is what a phone was already seeing.
 */
export function AmbientVideo({
  src,
  poster,
  className,
  minWidth = 768,
}: AmbientVideoProps) {
  const [wide, setWide] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${minWidth}px)`);
    const sync = () => setWide(query.matches);

    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [minWidth]);

  return (
    <video
      // Keyed on the breakpoint so React rebuilds the element rather than
      // mutating it: a <source> appended to a video that has already run its
      // resource selection is ignored until load() is called by hand.
      key={wide ? "wide" : "narrow"}
      className={className}
      poster={poster}
      autoPlay
      muted
      loop
      playsInline
      preload="none"
    >
      {wide && <source src={src} type="video/mp4" />}
    </video>
  );
}
