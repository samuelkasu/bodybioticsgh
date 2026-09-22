"use client";

import { useState } from "react";

import {
  CampaignFields,
  campaignFrom,
  campaignPayload,
  emptyCampaign,
  type CampaignValues,
} from "@/components/admin/CampaignFields";
import { Button } from "@/components/ui/Button";
import { InputField } from "@/components/ui/Field";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/Feedback";
import { apiErrorMessage } from "@/lib/api/http";
import { pageCount } from "@/lib/features/products/types";
import {
  useAdminCouponsQuery,
  useAdminCreateCouponMutation,
  useAdminDeleteCouponMutation,
  useAdminUpdateCouponMutation,
  type AdminCoupon,
} from "@/lib/features/promotions/promotionsApi";
import { formatMoney } from "@/lib/utils/money";

const PER_PAGE = 25;

type CouponValues = CampaignValues & {
  code: string;
  usageLimit: string;
  usageLimitPerCustomer: string;
  active: boolean;
};

const emptyCoupon: CouponValues = {
  ...emptyCampaign,
  code: "",
  usageLimit: "",
  usageLimitPerCustomer: "",
  active: true,
};

const valuesFrom = (coupon: AdminCoupon): CouponValues => ({
  ...campaignFrom(coupon),
  code: coupon.code,
  usageLimit: coupon.usageLimit === null ? "" : String(coupon.usageLimit),
  usageLimitPerCustomer:
    coupon.usageLimitPerCustomer === null ? "" : String(coupon.usageLimitPerCustomer),
  active: coupon.active,
});

/**
 * Discount codes. Unlike a promotion, a code is opted into, counted, and can
 * run out — so the list leads with how many uses are left rather than with the
 * offer itself.
 */
export function CouponAdmin() {
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<string | "new" | null>(null);

  const { data, isLoading, isError, error, refetch } = useAdminCouponsQuery({
    search: term,
    page,
    perPage: PER_PAGE,
  });

  const coupons = data?.items ?? [];
  const pages = pageCount(data?.total ?? 0, PER_PAGE);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            setTerm(search.trim());
            setPage(1);
          }}
          className="flex gap-2"
        >
          <label className="sr-only" htmlFor="admin-coupon-search">
            Search codes
          </label>
          <input
            id="admin-coupon-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by code…"
            className="focus-ring border-card-line/80 text-ink rounded-card min-h-12 w-full max-w-xs border px-4 text-base"
          />
          <button
            type="submit"
            className="focus-ring bg-ink hover:bg-cocoa rounded-card min-h-12 shrink-0 px-5 text-sm font-medium text-white transition-colors"
          >
            Search
          </button>
        </form>

        <Button onClick={() => setEditing(editing === "new" ? null : "new")}>
          {editing === "new" ? "Cancel" : "New code"}
        </Button>
      </div>

      {editing === "new" && (
        <CouponForm initial={emptyCoupon} onDone={() => setEditing(null)} />
      )}

      {isError ? (
        <ErrorState
          message={apiErrorMessage(error, "We could not load the codes.")}
          onRetry={() => void refetch()}
        />
      ) : isLoading ? (
        <div role="status" aria-label="Loading codes" className="grid gap-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-20" />
          ))}
        </div>
      ) : coupons.length === 0 ? (
        <EmptyState
          title="No discount codes"
          description="Create one to run an offer customers claim by typing a code."
        />
      ) : (
        <>
          <ul className="grid gap-2">
            {coupons.map((coupon) => (
              <CouponRow
                key={coupon.id}
                coupon={coupon}
                isEditing={editing === coupon.id}
                onToggle={() => setEditing(editing === coupon.id ? null : coupon.id)}
                onDone={() => setEditing(null)}
              />
            ))}
          </ul>

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
                Page {page} of {pages}
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

function CouponRow({
  coupon,
  isEditing,
  onToggle,
  onDone,
}: {
  coupon: AdminCoupon;
  isEditing: boolean;
  onToggle: () => void;
  onDone: () => void;
}) {
  const [remove, { isLoading: isRemoving }] = useAdminDeleteCouponMutation();
  const [failure, setFailure] = useState<string | null>(null);

  const onDelete = async () => {
    setFailure(null);
    try {
      await remove(coupon.id).unwrap();
    } catch (error) {
      setFailure(apiErrorMessage(error, "That code was not removed."));
    }
  };

  const used =
    coupon.usageLimit === null
      ? `${coupon.timesUsed} used`
      : `${coupon.timesUsed} of ${coupon.usageLimit} used`;

  return (
    <li className="border-card-line/70 grid gap-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ink font-semibold tracking-wide">
            {coupon.code}{" "}
            <span className="text-xs font-normal text-neutral-500">
              {coupon.isLive ? "· live" : coupon.active ? "· not live" : "· off"}
            </span>
          </p>
          <p className="text-sm text-neutral-600">{coupon.description}</p>
          <p className="mt-1 text-xs text-neutral-500">
            {used}
            {coupon.usageLimitPerCustomer !== null &&
              ` · ${coupon.usageLimitPerCustomer} per customer`}
            {coupon.minSpendMinor > 0 &&
              ` · over ${formatMoney(coupon.minSpendMinor, "GHS")}`}
            {coupon.endsAt &&
              ` · until ${new Date(coupon.endsAt).toLocaleDateString("en-GB")}`}
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={onToggle}>
            {isEditing ? "Close" : "Edit"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void onDelete()}
            disabled={isRemoving}
          >
            {/* A code that has been used is switched off rather than deleted:
                its redemptions point at real orders. */}
            {coupon.timesUsed > 0 ? "Turn off" : "Delete"}
          </Button>
        </div>
      </div>

      {failure && (
        <p role="alert" className="text-sm text-red-700">
          {failure}
        </p>
      )}

      {isEditing && (
        <CouponForm id={coupon.id} initial={valuesFrom(coupon)} onDone={onDone} />
      )}
    </li>
  );
}

function CouponForm({
  id,
  initial,
  onDone,
}: {
  id?: string;
  initial: CouponValues;
  onDone: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [failure, setFailure] = useState<string | null>(null);

  const [create, { isLoading: isCreating }] = useAdminCreateCouponMutation();
  const [update, { isLoading: isUpdating }] = useAdminUpdateCouponMutation();

  const busy = isCreating || isUpdating;

  const limit = (value: string): number | null => {
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    const parsed = Number(trimmed);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : Number.NaN;
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFailure(null);

    const code = values.code.trim().toUpperCase();

    if (!/^[A-Z0-9_-]+$/.test(code)) {
      setFailure("A code is letters, numbers, - and _ only.");
      return;
    }

    if (values.discountType === "BUYXGETY") {
      setFailure("Buy X get Y is set up as a promotion, not as a code.");
      return;
    }

    const usageLimit = limit(values.usageLimit);
    const usageLimitPerCustomer = limit(values.usageLimitPerCustomer);

    if (Number.isNaN(usageLimit) || Number.isNaN(usageLimitPerCustomer)) {
      setFailure("Usage limits must be whole numbers above zero, or left blank.");
      return;
    }

    const result = campaignPayload(values);
    if ("error" in result) {
      setFailure(result.error);
      return;
    }

    const body = {
      ...result.payload,
      code,
      usageLimit,
      usageLimitPerCustomer,
      active: values.active,
    };

    try {
      if (id) {
        await update({ id, ...body }).unwrap();
      } else {
        await create(body).unwrap();
      }
      onDone();
    } catch (error) {
      setFailure(apiErrorMessage(error, "That code was not saved."));
    }
  };

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      noValidate
      className="border-card-line/70 grid gap-4 rounded-xl border p-4"
    >
      <InputField
        label="Code"
        value={values.code}
        onChange={(event) => setValues({ ...values, code: event.target.value })}
        onBlur={() =>
          setValues((current) => ({
            ...current,
            code: current.code.trim().toUpperCase(),
          }))
        }
        autoCapitalize="characters"
        spellCheck={false}
        className="tracking-wide uppercase"
        hint="What the customer types. Letters, numbers, - and _."
        required
      />

      <CampaignFields
        values={values}
        onChange={(next) => setValues({ ...values, ...next })}
        disabled={busy}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <InputField
          label="Total uses"
          type="number"
          min={1}
          step={1}
          value={values.usageLimit}
          onChange={(event) => setValues({ ...values, usageLimit: event.target.value })}
          hint="Across all customers. Blank for unlimited."
        />

        <InputField
          label="Uses per customer"
          type="number"
          min={1}
          step={1}
          value={values.usageLimitPerCustomer}
          onChange={(event) =>
            setValues({ ...values, usageLimitPerCustomer: event.target.value })
          }
          hint="Counted by email. Blank for unlimited."
        />
      </div>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={values.active}
          onChange={(event) => setValues({ ...values, active: event.target.checked })}
          className="accent-ink h-4 w-4"
        />
        Active
      </label>

      {failure && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {failure}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : id ? "Save changes" : "Create code"}
        </Button>
        <Button type="button" variant="outline" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
