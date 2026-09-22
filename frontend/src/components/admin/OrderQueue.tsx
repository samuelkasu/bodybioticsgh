"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DatePicker } from "@/components/ui/DatePicker";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/Feedback";
import { apiErrorMessage } from "@/lib/api/http";
import { useAdminOrdersQuery } from "@/lib/features/admin/adminApi";
import { pageCount } from "@/lib/features/products/types";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";

const FILTERS = [
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "fulfilled", label: "Fulfilled" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded", label: "Refunded" },
  { value: "all", label: "All" },
];

/** Fifteen rows is about one screen of queue without scrolling past the fold. */
const PER_PAGE = 15;

/** Long enough that typing a reference does not fire a request per character. */
const SEARCH_DEBOUNCE_MS = 350;

export const STATUS_TONE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-900",
  PAID: "bg-emerald-100 text-emerald-900",
  FULFILLED: "bg-sky-100 text-sky-900",
  CANCELLED: "bg-neutral-200 text-neutral-700",
  REFUNDED: "bg-purple-100 text-purple-900",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        STATUS_TONE[status] ?? "bg-neutral-200 text-neutral-700",
      )}
    >
      {status}
    </span>
  );
}

/**
 * The queue staff work from. Defaults to Pending because that is the list that
 * needs acting on — every other status is history.
 */
export function OrderQueue() {
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  // The box staff type into, and the settled value the query actually uses.
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    if (draft === search) return;

    const timer = setTimeout(() => {
      setSearch(draft);
      // Page 4 of one search is rarely page 4 of the next.
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [draft, search]);

  const { data, isLoading, isFetching, isError, error, refetch } = useAdminOrdersQuery({
    status,
    search,
    from: from || undefined,
    to: to || undefined,
    page,
    perPage: PER_PAGE,
  });

  const orders = data?.items ?? [];
  const pages = pageCount(data?.total ?? 0, PER_PAGE);

  return (
    <div className="grid gap-4">
      <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            aria-pressed={status === filter.value}
            onClick={() => {
              setStatus(filter.value);
              // Page 3 of Pending is rarely page 3 of Cancelled.
              setPage(1);
            }}
            className={cn(
              "focus-ring rounded-card min-h-11 border px-4 text-sm font-medium transition-colors",
              status === filter.value
                ? "border-ink bg-ink text-white"
                : "border-card-line/80 text-ink hover:bg-sand/40",
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label
            htmlFor="admin-order-search"
            className="text-ink/60 text-caption block font-medium"
          >
            Search
          </label>
          {/* One box over every field, because staff are given whichever of
              them the customer has to hand — a reference from the confirmation
              email, a name, the number they called from. */}
          <input
            id="admin-order-search"
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Reference, name, email, phone or town"
            className="focus-ring border-card-line/80 text-ink rounded-card mt-1 min-h-11 w-full border px-4 text-sm"
          />
        </div>

        <div className="w-44">
          <p className="text-ink/60 text-caption font-medium">Placed from</p>
          <DatePicker
            label="Placed from"
            value={from}
            max={to || undefined}
            placeholder="Any date"
            onChange={(next) => {
              setFrom(next);
              setPage(1);
            }}
            className="mt-1"
          />
        </div>

        <div className="w-44">
          <p className="text-ink/60 text-caption font-medium">Placed to</p>
          <DatePicker
            label="Placed to"
            value={to}
            min={from || undefined}
            placeholder="Any date"
            onChange={(next) => {
              setTo(next);
              setPage(1);
            }}
            className="mt-1"
          />
        </div>

        {(draft || from || to) && (
          <button
            type="button"
            onClick={() => {
              setDraft("");
              setSearch("");
              setFrom("");
              setTo("");
              setPage(1);
            }}
            className="focus-ring border-card-line/80 text-ink hover:bg-sand/40 rounded-card min-h-11 border px-4 text-sm font-medium transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {isError ? (
        <ErrorState
          message={apiErrorMessage(error, "We could not load the order queue.")}
          onRetry={() => void refetch()}
        />
      ) : isLoading ? (
        <div role="status" aria-label="Loading orders" className="grid gap-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-16" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          title="Nothing here"
          description={
            search || from || to
              ? "No orders match that search. Try a shorter term or a wider date range."
              : status === "pending"
                ? "No orders are waiting to be confirmed."
                : "No orders with that status."
          }
        />
      ) : (
        <>
          {/* A table on a desktop, stacked cards on a phone: staff check the
              queue from their phone as often as from a counter. */}
          <div
            className={cn(
              "overflow-x-auto",
              isFetching && "opacity-60 transition-opacity",
            )}
          >
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="text-ink/60 border-card-line/70 border-b">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Reference
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Placed
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Customer
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Phone
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Items
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Total
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.reference}
                    className="border-card-line/50 hover:bg-sand/30 border-b"
                  >
                    <td className="py-3 pr-4">
                      <Link
                        href={`/admin/orders/${order.reference}`}
                        className="focus-ring text-caption font-mono underline-offset-4 hover:underline"
                      >
                        {order.reference}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap text-neutral-600">
                      {new Date(order.createdAt).toLocaleString("en-GB", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="py-3 pr-4">{order.fullName}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {/* Tappable: confirming by phone is the first step. */}
                      <a
                        href={`tel:${order.phone.replace(/\s/g, "")}`}
                        className="focus-ring underline-offset-4 hover:underline"
                      >
                        {order.phone}
                      </a>
                    </td>
                    <td className="py-3 pr-4">{order.itemCount}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {formatMoney(order.totalMinor, order.currency)}
                    </td>
                    <td className="py-3">
                      <StatusBadge status={order.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="focus-ring border-card-line/80 rounded-card min-h-11 border px-4 text-sm disabled:opacity-40"
              >
                Previous
              </button>
              <p className="text-sm text-neutral-600">
                Page {page} of {pages} · {data?.total ?? 0} orders
              </p>
              <button
                type="button"
                disabled={page >= pages}
                onClick={() => setPage((current) => Math.min(pages, current + 1))}
                className="focus-ring border-card-line/80 rounded-card min-h-11 border px-4 text-sm disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
