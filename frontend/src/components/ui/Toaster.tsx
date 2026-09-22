"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  AlertIcon,
  BagIcon,
  CheckIcon,
  ChevronRightIcon,
  CloseIcon,
  HeartFilledIcon,
  HeartIcon,
  InfoIcon,
} from "@/components/ui/Icons";
import { selectToasts, toastDismissed, type Toast } from "@/lib/features/ui/toastSlice";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";

/** Long enough to read a product name on a phone, short enough not to nag. */
const DISMISS_MS = 5_000;

/** Matches the toast-out keyframe; the card unmounts when it finishes. */
const EXIT_MS = 200;

/** How much of each older card peeks out from under the newest one. */
const PEEK_PX = 12;
/** Gap between cards once the stack is opened. */
const GAP_PX = 10;

/**
 * The confirmation layer the storefront was missing.
 *
 * The header's basket count is the only other signal that an add worked, and
 * the header is not sticky — on a catalogue page scrolled halfway down it is
 * off-screen, so a customer taps "Add to cart" and sees nothing happen. They
 * tap again. This is what stops that.
 *
 * Bottom-centre rather than top-right: on a phone the top of the screen is
 * furthest from the thumb, and the bottom is where the customer is already
 * looking at the buttons they just pressed.
 *
 * Toasts stack on top of each other rather than forming a column. Three cards
 * in a column eat half a phone screen and bury the product the customer is
 * still shopping; stacked, the newest is always readable and the older ones
 * are one hover (or tap) away.
 */
export function Toaster() {
  const toasts = useAppSelector(selectToasts);
  const [expanded, setExpanded] = useState(false);
  const [heights, setHeights] = useState<Record<string, number>>({});

  // Newest first: it sits at the front of the stack, at the bottom of the
  // screen, where the thumb and the eye already are.
  const stack = [...toasts].reverse();

  const measure = useCallback((id: string, height: number) => {
    setHeights((prev) => (prev[id] === height ? prev : { ...prev, [id]: height }));
  }, []);

  // Dropped on unmount rather than swept later, otherwise the map grows for
  // the whole session.
  const forget = useCallback((id: string) => {
    setHeights((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  // An empty stack is never "open", whatever the pointer last did.
  const open = expanded && stack.length > 0;

  const heightOf = (toast: Toast) => heights[toast.id] ?? 0;
  const spread = Math.max(0, stack.length - 1);
  const collapsedHeight = (stack[0] ? heightOf(stack[0]) : 0) + spread * PEEK_PX;
  const expandedHeight =
    stack.reduce((total, toast) => total + heightOf(toast), 0) + spread * GAP_PX;

  return (
    <div
      // polite, not assertive: an add-to-cart confirmation must not interrupt
      // a screen reader mid-sentence. The region is always in the tree so
      // assistive tech is already watching it when the first toast lands.
      aria-live="polite"
      aria-atomic="false"
      className="safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-4"
    >
      {stack.length > 0 && (
        <div
          className="pointer-events-auto relative w-full max-w-sm transition-[height] duration-300 ease-out motion-reduce:transition-none"
          style={{ height: open ? expandedHeight : collapsedHeight }}
          onMouseEnter={() => setExpanded(true)}
          onMouseLeave={() => setExpanded(false)}
          onFocusCapture={() => setExpanded(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setExpanded(false);
            }
          }}
          // No hover on a phone, so a tap opens the stack instead.
          onClick={() => setExpanded(true)}
        >
          {stack.map((toast, depth) => (
            <ToastCard
              key={toast.id}
              toast={toast}
              depth={depth}
              count={stack.length}
              expanded={open}
              offset={stack
                .slice(0, depth)
                .reduce((total, above) => total + heightOf(above) + GAP_PX, 0)}
              onMeasure={measure}
              onForget={forget}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Card and border share one surface colour, so the card reads as one shape. */
const TONE_CLASS: Record<Toast["tone"], { card: string; chip: string; action: string }> =
  {
    success: {
      card: "border-card bg-card",
      chip: "bg-olive text-white",
      action: "text-olive",
    },
    error: {
      card: "border-card bg-card",
      chip: "bg-pager text-white",
      action: "text-pager",
    },
    info: {
      card: "border-card bg-card",
      chip: "bg-cocoa text-white",
      action: "text-cocoa",
    },
  };

const ICONS: Record<Toast["icon"], typeof CheckIcon> = {
  cart: BagIcon,
  heart: HeartFilledIcon,
  "heart-off": HeartIcon,
  check: CheckIcon,
  alert: AlertIcon,
  info: InfoIcon,
};

function ToastCard({
  toast,
  depth,
  count,
  expanded,
  offset,
  onMeasure,
  onForget,
}: {
  toast: Toast;
  depth: number;
  count: number;
  expanded: boolean;
  offset: number;
  onMeasure: (id: string, height: number) => void;
  onForget: (id: string) => void;
}) {
  const dispatch = useAppDispatch();
  const tone = TONE_CLASS[toast.tone];
  const Icon = ICONS[toast.icon];

  // The card leaves the DOM only after it has animated out, so dismissal is a
  // local flag first and a store dispatch second. Dispatching straight away
  // would unmount the card mid-animation and it would simply blink off.
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!exiting) return;
    const timer = setTimeout(() => dispatch(toastDismissed(toast.id)), EXIT_MS);
    return () => clearTimeout(timer);
  }, [dispatch, exiting, toast.id]);

  // Reading the stack pauses the clock; a toast must not vanish mid-sentence
  // while the customer is hovering it. Remaining time is carried across the
  // pause rather than restarted, so an open-and-close does not extend it.
  const remaining = useRef(DISMISS_MS);
  const startedAt = useRef(0);

  useEffect(() => {
    if (expanded || exiting) return;
    startedAt.current = Date.now();
    const timer = setTimeout(() => setExiting(true), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(
        0,
        remaining.current - (Date.now() - startedAt.current),
      );
    };
  }, [expanded, exiting]);

  // Observed, not measured once: a long product name wraps to a different
  // height when the phone rotates, and the cards above it have to move.
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = cardRef.current;
    if (!node) return;
    onMeasure(toast.id, node.offsetHeight);
    const observer = new ResizeObserver(() => onMeasure(toast.id, node.offsetHeight));
    observer.observe(node);
    return () => {
      observer.disconnect();
      onForget(toast.id);
    };
  }, [onForget, onMeasure, toast.id]);

  // Collapsed, only the front card is readable — the ones behind are edges of
  // paper, not competing sentences.
  const buried = !expanded && depth > 0;

  return (
    <div
      ref={cardRef}
      className={`absolute inset-x-0 bottom-0 origin-bottom transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none ${exiting ? "pointer-events-none" : ""}`}
      style={{
        zIndex: count - depth,
        transform: expanded
          ? `translate3d(0, ${-offset}px, 0)`
          : `translate3d(0, ${-depth * PEEK_PX}px, 0) scale(${1 - depth * 0.05})`,
      }}
    >
      <div
        role="status"
        className={`${exiting ? "toast-out" : "toast-in"} text-ink relative flex items-start gap-3 overflow-hidden rounded-2xl border px-4 py-3 shadow-[0_12px_32px_-12px_rgba(16,16,16,0.4)] ${tone.card}`}
      >
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${tone.chip} ${buried ? "opacity-0" : ""} transition-opacity duration-200`}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>

        <div
          className={`min-w-0 flex-1 transition-opacity duration-200 ${buried ? "opacity-0" : ""}`}
        >
          <p className="text-sm leading-snug">{toast.message}</p>

          {toast.action && (
            <Link
              href={toast.action.href}
              onClick={() => setExiting(true)}
              tabIndex={buried ? -1 : undefined}
              className={`focus-ring tracking-caps mt-1.5 inline-flex items-center gap-1 text-xs font-semibold uppercase ${tone.action}`}
            >
              {toast.action.label}
              <ChevronRightIcon className="h-3 w-3" />
            </Link>
          )}
        </div>

        <button
          type="button"
          onClick={() => setExiting(true)}
          aria-label="Dismiss"
          tabIndex={buried ? -1 : undefined}
          className={`focus-ring text-taupe hover:bg-chip hover:text-ink -mr-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition ${buried ? "opacity-0" : ""}`}
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
