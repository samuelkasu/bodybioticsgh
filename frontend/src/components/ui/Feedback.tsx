import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("shimmer rounded-lg", className)} />;
}

export type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  /** Illustration above the copy. Omitted, the block keeps its plain layout. */
  art?: ReactNode;
};

export function EmptyState({ title, description, action, art }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 px-6 py-12 text-center">
      {art && <div className="mb-5 flex justify-center">{art}</div>}
      <p className="font-display text-ink text-lg">{title}</p>
      {description && (
        <p className="font-display mt-1 text-base text-neutral-600">{description}</p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export type ErrorStateProps = {
  title?: string;
  message: string;
  onRetry?: (() => void) | undefined;
};

/**
 * Used wherever a fetch can fail. On a PWA the failure is usually the network,
 * not the server, so the copy avoids blaming the shop and always offers a retry.
 */
export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center"
    >
      <p className="font-medium text-red-900">{title}</p>
      <p className="mt-1 text-sm text-red-800">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="focus-ring bg-ink mt-4 min-h-11 rounded-lg px-4 text-sm font-medium text-white"
        >
          Try again
        </button>
      )}
    </div>
  );
}
