/**
 * Illustration for the catalogue's empty result: a lens drifting over two
 * shelved jars. Drawn with the brand tokens rather than a stock graphic so it
 * sits beside the product cards without looking borrowed.
 *
 * The motion classes live in globals.css; the base reduced-motion rule there
 * freezes them, and every shape's resting position is its first keyframe.
 */
export function EmptySearchArt({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 200 160" fill="none" className={className}>
      <circle
        cx="100"
        cy="82"
        r="54"
        className="empty-art-halo"
        fill="var(--color-sand)"
      />
      <circle cx="100" cy="82" r="54" stroke="var(--color-sand-deep)" strokeWidth="1" />

      {/* shelf */}
      <rect x="46" y="118" width="108" height="4" rx="2" fill="var(--color-sand-deep)" />

      {/* squat jar */}
      <g className="empty-art-float">
        <rect
          x="62"
          y="84"
          width="32"
          height="34"
          rx="9"
          fill="var(--color-cream)"
          stroke="var(--color-taupe)"
          strokeWidth="2"
        />
        <rect x="68" y="76" width="20" height="9" rx="3" fill="var(--color-taupe)" />
        <rect
          x="70"
          y="97"
          width="16"
          height="2.5"
          rx="1.25"
          fill="var(--color-sand-deep)"
        />
      </g>

      {/* tall bottle */}
      <g className="empty-art-float empty-art-float-slow">
        <rect
          x="106"
          y="70"
          width="26"
          height="48"
          rx="8"
          fill="var(--color-cream)"
          stroke="var(--color-taupe)"
          strokeWidth="2"
        />
        <rect x="115" y="60" width="8" height="12" rx="2" fill="var(--color-taupe)" />
        <rect
          x="112"
          y="86"
          width="14"
          height="2.5"
          rx="1.25"
          fill="var(--color-sand-deep)"
        />
      </g>

      {/* rising specks */}
      <circle
        cx="58"
        cy="66"
        r="2.5"
        fill="var(--color-taupe)"
        className="empty-art-spark"
      />
      <circle
        cx="142"
        cy="58"
        r="2"
        fill="var(--color-taupe)"
        className="empty-art-spark empty-art-spark-late"
      />
      <circle
        cx="128"
        cy="42"
        r="1.6"
        fill="var(--color-taupe)"
        className="empty-art-spark empty-art-spark-later"
      />

      {/* lens */}
      <g className="empty-art-lens">
        <circle
          cx="112"
          cy="74"
          r="27"
          fill="var(--color-cream)"
          fillOpacity="0.55"
          stroke="var(--color-ink)"
          strokeWidth="4"
        />
        <path
          d="M98 66a16 16 0 0 1 11-9"
          stroke="var(--color-cream)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M132 94l16 16"
          stroke="var(--color-ink)"
          strokeWidth="7"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
