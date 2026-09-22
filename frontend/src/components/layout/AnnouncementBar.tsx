"use client";

import { useStorefrontPromotionsQuery } from "@/lib/features/promotions/promotionsApi";
import { site } from "@/lib/site";

/**
 * Sand strip above the header (#F0E0D2 in the original) with dark brown text,
 * scrolling. The track is duplicated so the loop has no visible seam, and the
 * second copy is aria-hidden — a screen reader should hear the offer once, not
 * endlessly.
 *
 * What it says comes from whichever campaigns are running and have been given
 * banner copy. With none, it falls back to the shop's standing line, so the
 * bar is never empty and never waits on a request to render something.
 */
export function AnnouncementBar() {
  const { data } = useStorefrontPromotionsQuery();

  const messages = data?.banners.length ? data.banners : [site.announcement];

  // Enough repeats to fill a wide screen whatever the copy is. One long
  // campaign line needs fewer tiles than the short standing one.
  const repeats = Math.max(2, Math.ceil(8 / messages.length));
  const track = Array.from({ length: repeats }, () => messages).flat();

  return (
    // 5.6px top and bottom around the 27px line box: a 38px bar, a quarter
    // shorter than the 51px it used to be.
    <div className="bg-blush text-cocoa-deep overflow-hidden py-1.5">
      <div className="marquee-track flex w-max motion-reduce:animate-none">
        {[0, 1].map((copy) => (
          <div
            key={copy}
            className="flex shrink-0"
            aria-hidden={copy === 1 ? true : undefined}
          >
            {track.map((message, index) => (
              <span
                key={index}
                // Type and spacing from the original's marquee: Inter Tight
                // 18px/500, 0.6px tracking, 51px between items.
                className="text-body-lg tracking-caps flex items-center gap-10 px-6 font-medium whitespace-nowrap"
              >
                {message}
                <span aria-hidden="true" className="text-cocoa-deep/50">
                  —
                </span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
