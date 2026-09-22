import Link from "next/link";

import { cn } from "@/lib/utils/cn";

export type PaginationProps = {
  page: number;
  totalPages: number;
  /** Builds the href for a page; the caller owns how state lives in the URL. */
  buildHref: (page: number) => string;
  /** Renders the "Load More" button; omitted on the last page. */
  onLoadMore?: (() => void) | undefined;
  isLoadingMore?: boolean;
};

/**
 * Window of page numbers around the current page. With 15 pages of catalogue a
 * full list does not fit on a phone, and "…" is clearer than a scrollbar.
 */
export function pageWindow(page: number, totalPages: number, span = 1): number[] {
  const pages = new Set<number>([1, totalPages]);

  for (let offset = -span; offset <= span; offset++) {
    const candidate = page + offset;
    if (candidate >= 1 && candidate <= totalPages) pages.add(candidate);
  }

  return [...pages].sort((a, b) => a - b);
}

/** Up to this many pages are listed in full, as the original's pager does. */
const FULL_LIST_LIMIT = 13;

export function Pagination({
  page,
  totalPages,
  buildHref,
  onLoadMore,
  isLoadingMore = false,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages =
    totalPages <= FULL_LIST_LIMIT
      ? Array.from({ length: totalPages }, (_, index) => index + 1)
      : pageWindow(page, totalPages);
  const isFirst = page <= 1;
  const isLast = page >= totalPages;

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-center gap-y-1.5 py-6"
    >
      <PageLink href={buildHref(page - 1)} disabled={isFirst} label="Previous page">
        Prev
      </PageLink>

      {pages.map((candidate, index) => {
        const previous = pages[index - 1];
        const gap = previous !== undefined && candidate - previous > 1;

        return (
          <span key={candidate} className="flex items-center">
            {gap && (
              <span aria-hidden="true" className="px-4.5 py-2.5 text-neutral-400">
                …
              </span>
            )}
            <PageLink
              href={buildHref(candidate)}
              label={`Page ${candidate}`}
              current={candidate === page}
            >
              {candidate}
            </PageLink>
          </span>
        );
      })}

      <PageLink href={buildHref(page + 1)} disabled={isLast} label="Next page">
        Next
      </PageLink>

      {onLoadMore && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={isLoadingMore}
          className="focus-ring hover:bg-sand font-display text-body ml-3 rounded-lg bg-black px-4.5 py-2.5 font-semibold text-white transition-colors hover:text-black disabled:opacity-60"
        >
          {isLoadingMore ? "Loading…" : "Load More"}
        </button>
      )}
    </nav>
  );
}

type PageLinkProps = {
  href: string;
  label: string;
  children: React.ReactNode;
  current?: boolean;
  disabled?: boolean;
};

function PageLink({ href, label, children, current, disabled }: PageLinkProps) {
  // 16px/600 at 10px 18px, as the original's pager renders.
  const base =
    "focus-ring inline-flex min-h-11 items-center justify-center rounded-md px-4.5 py-2.5 text-body font-semibold hover:no-underline";

  if (disabled) {
    return (
      <span aria-disabled="true" className={cn(base, "text-neutral-300")}>
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={current ? "page" : undefined}
      className={cn(
        base,
        current
          ? "text-lime bg-[#080a04]"
          : "text-pager hover:text-lime hover:bg-[#080a04]",
      )}
    >
      {children}
    </Link>
  );
}
