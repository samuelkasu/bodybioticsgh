"use client";

export type PriceRangeSliderProps = {
  /** Catalogue bounds, in major units (cedis). */
  min: number;
  max: number;
  step?: number;
  /** Current handles, in major units. */
  value: [number, number];
  onChange: (value: [number, number]) => void;
  /** Fires when the handle is released — the point at which we refetch. */
  onCommit?: (value: [number, number]) => void;
};

const format = (amount: number) =>
  new Intl.NumberFormat("en-GH", { maximumFractionDigits: 0 }).format(amount);

/**
 * Two handles on one track, with the cedi readout underneath, as on the
 * original ("₵ 15 — ₵ 1,515"). Handles cannot cross.
 */
export function PriceRangeSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  onCommit,
}: PriceRangeSliderProps) {
  const [low, high] = value;
  // Guard a degenerate catalogue (one product, so min === max) against /0.
  const span = Math.max(max - min, 1);
  const leftPercent = ((low - min) / span) * 100;
  const rightPercent = ((high - min) / span) * 100;

  const commit = (next: [number, number]) => {
    onChange(next);
    onCommit?.(next);
  };

  return (
    <div>
      <div className="relative h-4">
        {/* Selected span reads as the pale gap between two black handles, as
            on the original — the rail outside the range stays dark. */}
        <div className="bg-ink absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full">
          <div
            className="absolute h-full rounded-full bg-[#e4e2dd]"
            style={{ left: `${leftPercent}%`, right: `${100 - rightPercent}%` }}
          />
        </div>

        <input
          type="range"
          className="range-input"
          min={min}
          max={max}
          step={step}
          value={low}
          aria-label="Minimum price"
          onChange={(event) =>
            onChange([Math.min(Number(event.target.value), high), high])
          }
          onPointerUp={() => commit([low, high])}
          onKeyUp={() => commit([low, high])}
        />

        <input
          type="range"
          className="range-input"
          min={min}
          max={max}
          step={step}
          value={high}
          aria-label="Maximum price"
          onChange={(event) => onChange([low, Math.max(Number(event.target.value), low)])}
          onPointerUp={() => commit([low, high])}
          onKeyUp={() => commit([low, high])}
        />
      </div>

      <p className="text-body-lg mt-2 font-semibold text-black">
        <span aria-hidden="true">₵ </span>
        {format(low)} — <span aria-hidden="true">₵ </span>
        {format(high)}
      </p>
    </div>
  );
}
