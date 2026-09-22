"use client";

import { useEffect, useRef, useState } from "react";
import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export type RevealProps = {
  /** fadeInUp is the original's default; left/right are used by two-column blocks. */
  animation?: "up" | "left" | "right";
  /** Stagger, in milliseconds, so a group of widgets arrives in order. */
  delay?: number;
  as?: ElementType;
  className?: string;
  children: ReactNode;
};

/**
 * One-shot entrance animation, fired when the element first scrolls into view —
 * the Elementor behaviour the original pages use. It unobserves after firing so
 * scrolling back up does not replay it.
 */
export function Reveal({
  animation = "up",
  delay = 0,
  as: Tag = "div",
  className,
  children,
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || shown) return;

    // No IntersectionObserver (old Safari, jsdom): show it rather than hide it.
    // Deferred to a frame so the first paint still matches the server markup.
    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [shown]);

  return (
    <Tag
      ref={ref}
      className={cn("reveal", className)}
      data-animation={animation}
      data-shown={shown ? "true" : "false"}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
