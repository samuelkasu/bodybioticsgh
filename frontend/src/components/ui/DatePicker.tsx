"use client";

import { useEffect, useId, useRef, useState } from "react";

import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/Icons";
import {
  WEEKDAYS,
  addDays,
  addMonths,
  formatLong,
  formatMonthYear,
  formatShort,
  fromIso,
  isOutOfRange,
  isSameDay,
  isSameMonth,
  monthGrid,
  startOfDay,
  toIso,
} from "@/lib/utils/calendar";
import { cn } from "@/lib/utils/cn";

export type DatePickerProps = {
  /** `yyyy-mm-dd`, or "" for no date. Same shape an <input type="date"> posts. */
  value: string;
  onChange: (value: string) => void;
  label: string;
  /** Set when an outer <label htmlFor> points at the trigger. */
  id?: string | undefined;
  describedBy?: string | undefined;
  invalid?: boolean | undefined;
  /** Inclusive bounds, also `yyyy-mm-dd`. */
  min?: string | undefined;
  max?: string | undefined;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * The shop's own date picker, in place of `<input type="date">`.
 *
 * The native control was the one piece of chrome the browser drew for us: a
 * grey `mm/dd/yyyy` in the browser's locale rather than the shop's, with a
 * calendar nobody could style. This is the same control in the site's own
 * type, colours and radii, and it reads dates back as "20 Sep 2026" instead of
 * a slash-separated string staff have to decode.
 *
 * Keyboard support matches the WAI-ARIA date picker dialog pattern: arrows
 * move a day, PageUp/PageDown a month, Home/End the week, Enter picks and
 * Escape closes back onto the button.
 */
export function DatePicker({
  value,
  onChange,
  label,
  id,
  describedBy,
  invalid,
  min,
  max,
  placeholder = "Pick a date",
  disabled = false,
  className,
}: DatePickerProps) {
  const selected = fromIso(value);
  const lowest = fromIso(min);
  const highest = fromIso(max);

  const [open, setOpen] = useState(false);
  // The day the arrow keys are on. Separate from the selection, because moving
  // around the grid must not commit a date the user has not chosen yet.
  const [cursor, setCursor] = useState(() => selected ?? startOfDay(new Date()));

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  // Set while the panel is open, so focus follows the arrow keys; cleared on
  // close so reopening does not steal focus from wherever it went.
  const focusDay = useRef(false);

  const dialogId = useId();

  // A parent can change the value underneath us — a cleared filter, a form
  // reset. Adjusting during render keeps the grid from flashing the old month.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (selected) setCursor(selected);
  }

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };

    // Capture, so a click on a button elsewhere closes the panel before that
    // button's own handler runs and moves the page underneath it.
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  // Focus follows the cursor only while the user is driving the grid.
  useEffect(() => {
    if (!open || !focusDay.current) return;
    gridRef.current?.querySelector<HTMLButtonElement>('[data-active="true"]')?.focus();
  });

  const openPanel = () => {
    if (disabled) return;
    setCursor(selected ?? startOfDay(new Date()));
    focusDay.current = true;
    setOpen(true);
  };

  const closePanel = (returnFocus = true) => {
    focusDay.current = false;
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  const pick = (day: Date) => {
    if (isOutOfRange(day, lowest, highest)) return;
    onChange(toIso(day));
    closePanel();
  };

  const onGridKeyDown = (event: React.KeyboardEvent) => {
    const moves: Record<string, () => Date> = {
      ArrowLeft: () => addDays(cursor, -1),
      ArrowRight: () => addDays(cursor, 1),
      ArrowUp: () => addDays(cursor, -7),
      ArrowDown: () => addDays(cursor, 7),
      PageUp: () => addMonths(cursor, -1),
      PageDown: () => addMonths(cursor, 1),
      // Monday and Sunday of the cursor's week.
      Home: () => addDays(cursor, -((cursor.getDay() + 6) % 7)),
      End: () => addDays(cursor, 6 - ((cursor.getDay() + 6) % 7)),
    };

    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      focusDay.current = true;
      setCursor(move());
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closePanel();
    }
  };

  const days = monthGrid(cursor);
  const today = startOfDay(new Date());
  // Stepping past a bound would show a month with nothing selectable in it.
  const canGoBack = !lowest || !isSameMonth(cursor, lowest);
  const canGoForward = !highest || !isSameMonth(cursor, highest);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        // No aria-invalid: a button has no validity state for it to describe.
        // The failure reaches assistive tech through the error text this points
        // at, which the field renders with role="alert".
        aria-describedby={describedBy}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        aria-label={selected ? `${label}: ${formatLong(selected)}` : label}
        onClick={() => (open ? closePanel() : openPanel())}
        className={cn(
          "focus-ring border-card-line/80 text-ink rounded-card flex min-h-11 w-full items-center justify-between gap-3 border bg-white px-4 text-sm transition-colors",
          "hover:border-ink/40 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400",
          open && "border-ink/60",
          invalid && "border-red-500",
        )}
      >
        <span className={cn(!selected && "text-neutral-400")}>
          {selected ? formatShort(selected) : placeholder}
        </span>
        <CalendarIcon className="h-4.5 w-4.5 shrink-0 text-neutral-500" />
      </button>

      {open && (
        <div
          id={dialogId}
          role="dialog"
          aria-modal="false"
          aria-label={label}
          // Right-anchored as well as left so a picker near the right edge of a
          // filter bar opens inwards instead of off the screen.
          className="border-card-line/80 rounded-panel absolute top-[calc(100%+0.5rem)] left-0 z-50 w-[19rem] max-w-[calc(100vw-2rem)] border bg-white p-3 shadow-[0_18px_40px_-20px_rgba(16,16,16,0.45)]"
        >
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={!canGoBack}
              aria-label="Previous month"
              onClick={() => {
                focusDay.current = false;
                setCursor(addMonths(cursor, -1));
              }}
              className="focus-ring text-ink hover:bg-sand/50 rounded-control grid h-9 w-9 place-items-center transition-colors disabled:opacity-30"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>

            {/* Polite, not assertive: stepping through months should narrate
                the month, not interrupt whatever else is being read. */}
            <p aria-live="polite" className="text-ink text-sm font-semibold">
              {formatMonthYear(cursor)}
            </p>

            <button
              type="button"
              disabled={!canGoForward}
              aria-label="Next month"
              onClick={() => {
                focusDay.current = false;
                setCursor(addMonths(cursor, 1));
              }}
              className="focus-ring text-ink hover:bg-sand/50 rounded-control grid h-9 w-9 place-items-center transition-colors disabled:opacity-30"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-2 grid grid-cols-7 gap-0.5" aria-hidden="true">
            {WEEKDAYS.map((day) => (
              <span
                key={day}
                className="tracking-label grid h-7 place-items-center text-[0.6875rem] font-semibold text-neutral-500 uppercase"
              >
                {day.slice(0, 1)}
              </span>
            ))}
          </div>

          <div
            ref={gridRef}
            role="grid"
            aria-label={formatMonthYear(cursor)}
            onKeyDown={onGridKeyDown}
            className="grid grid-cols-7 gap-0.5"
          >
            {days.map((day) => {
              const outside = !isSameMonth(day, cursor);
              const blocked = isOutOfRange(day, lowest, highest);
              const isSelected = selected !== null && isSameDay(day, selected);
              const isCursor = isSameDay(day, cursor);

              return (
                <button
                  key={day.getTime()}
                  type="button"
                  role="gridcell"
                  // One tab stop for the whole grid; the arrows do the rest.
                  tabIndex={isCursor ? 0 : -1}
                  data-active={isCursor}
                  disabled={blocked}
                  aria-label={formatLong(day)}
                  aria-selected={isSelected}
                  aria-current={isSameDay(day, today) ? "date" : undefined}
                  onClick={() => pick(day)}
                  className={cn(
                    "focus-ring rounded-control grid h-9 place-items-center text-sm transition-colors",
                    isSelected
                      ? "bg-olive font-semibold text-white"
                      : blocked
                        ? "cursor-not-allowed text-neutral-300"
                        : outside
                          ? "hover:bg-sand/40 text-neutral-400"
                          : "text-ink hover:bg-sand/60",
                    // Today keeps a ring when it is not the selection, so the
                    // grid always says where "now" is.
                    !isSelected &&
                      isSameDay(day, today) &&
                      "ring-olive/50 font-semibold ring-1 ring-inset",
                  )}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="border-card-line/70 mt-3 flex items-center justify-between gap-2 border-t pt-3">
            <button
              type="button"
              disabled={isOutOfRange(today, lowest, highest)}
              onClick={() => pick(today)}
              className="focus-ring text-ink hover:bg-sand/50 rounded-control min-h-9 px-3 text-sm font-medium transition-colors disabled:opacity-40"
            >
              Today
            </button>

            <button
              type="button"
              disabled={!value}
              onClick={() => {
                onChange("");
                closePanel();
              }}
              className="focus-ring hover:bg-sand/50 rounded-control min-h-9 px-3 text-sm font-medium text-neutral-600 transition-colors disabled:opacity-40"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
