"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/Feedback";
import { useGetSessionQuery } from "@/lib/features/auth/authApi";

/**
 * Hides the admin screens from anyone who is not staff.
 *
 * This is presentation only. Every admin endpoint is behind the API's admin
 * policy, so a customer who reaches these routes gets 403s and an empty screen
 * — the guard just spares them a wall of errors. Never treat it as the control.
 */
export function AdminGuard({ children }: { children: ReactNode }) {
  const { data, isLoading } = useGetSessionQuery();

  if (isLoading) {
    return (
      <div role="status" aria-label="Checking your access" className="grid gap-3">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const user = data?.user ?? null;

  if (!user) {
    return (
      <Notice
        title="Sign in to continue"
        body="These screens are for shop staff."
        action={{ href: "/account/login?next=/admin", label: "Sign in" }}
      />
    );
  }

  if (user.role !== "ADMIN") {
    return (
      <Notice
        title="Not available on this account"
        body="Ask whoever administers the shop to give this account staff access."
        action={{ href: "/", label: "Back to the shop" }}
      />
    );
  }

  return <>{children}</>;
}

function Notice({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action: { href: string; label: string };
}) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 px-6 py-12 text-center">
      <p className="font-display text-ink text-lg">{title}</p>
      <p className="mt-1 text-base text-neutral-600">{body}</p>
      <Link
        href={action.href}
        className="focus-ring bg-ink hover:bg-cocoa rounded-card mt-5 inline-flex min-h-12 items-center justify-center px-6 text-base font-medium text-white transition-colors duration-200"
      >
        {action.label}
      </Link>
    </div>
  );
}
