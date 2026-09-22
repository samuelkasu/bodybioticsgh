"use client";

import { useEffect, useRef, useState } from "react";

export type ShopSearchProps = {
  value: string;
  onChange: (value: string | null) => void;
};

/** The original searches after the third character; below that it shows everything. */
const MIN_LETTERS = 3;
const DEBOUNCE_MS = 350;

/**
 * Full-width search box above the grid. Typing does not fire a request per
 * keystroke — it settles first, which matters on a metered connection.
 */
export function ShopSearch({ value, onChange }: ShopSearchProps) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  // Held in a ref so the effect below does not re-run when the callback
  // identity changes on a parent render.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Back/forward and "clear filters" change the URL underneath us. Adjusting
  // during render rather than in an effect avoids a second pass with the stale
  // text on screen (https://react.dev/reference/react/useState).
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value);
  }

  useEffect(() => {
    if (draft === value) return;

    const trimmed = draft.trim();
    if (trimmed.length > 0 && trimmed.length < MIN_LETTERS) return;

    const timer = setTimeout(() => onChangeRef.current(trimmed || null), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, value]);

  const trimmed = draft.trim();
  // Typing "Q10" and having the page sit there looking identical reads as
  // broken. Say why nothing is happening instead of leaving them guessing.
  const belowMinimum = trimmed.length > 0 && trimmed.length < MIN_LETTERS;

  return (
    <div className="relative mb-5">
      <input
        ref={inputRef}
        type="search"
        name="q"
        autoComplete="off"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Search Products..."
        aria-label="Search products"
        aria-describedby={belowMinimum ? "shop-search-hint" : undefined}
        className="focus-ring rounded-card text-body tracking-label md:text-body-lg w-full border border-[#7c8a73]/35 bg-white px-4 py-4 font-medium text-[#424242] placeholder:text-[#424242]"
      />

      {draft.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setDraft("");
            onChange(null);
            inputRef.current?.focus();
          }}
          aria-label="Clear search"
          className="focus-ring absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-2 text-[#424242]"
        >
          <svg aria-hidden="true" viewBox="0 0 22 28" className="h-3.5 w-3 fill-current">
            <path d="M20.281 20.656c0 .391-.156.781-.438 1.062l-2.125 2.125a1.5 1.5 0 0 1-2.124 0l-4.594-4.594-4.594 4.594a1.5 1.5 0 0 1-2.124 0l-2.125-2.125a1.5 1.5 0 0 1 0-2.124L7.751 15l-4.594-4.594a1.5 1.5 0 0 1 0-2.124l2.125-2.125a1.5 1.5 0 0 1 2.124 0L12 10.751l4.594-4.594a1.5 1.5 0 0 1 2.124 0l2.125 2.125a1.5 1.5 0 0 1 0 2.124L16.249 15l4.594 4.594c.282.281.438.671.438 1.062z" />
          </svg>
        </button>
      )}

      {belowMinimum && (
        <p id="shop-search-hint" role="status" className="mt-2 text-sm text-[#666666]">
          Keep typing — searching starts at {MIN_LETTERS} letters.
        </p>
      )}
    </div>
  );
}
