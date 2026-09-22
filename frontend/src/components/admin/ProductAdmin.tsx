"use client";

import { useState } from "react";

import { DatePicker } from "@/components/ui/DatePicker";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/Feedback";
import { apiErrorMessage } from "@/lib/api/http";
import {
  useAdminProductsQuery,
  useAdminUpdateProductMutation,
} from "@/lib/features/admin/adminApi";
import type { AdminProduct, ProductPatch } from "@/lib/features/admin/adminApi";
import { pageCount } from "@/lib/features/products/types";
import { formatMoney } from "@/lib/utils/money";

const PER_PAGE = 25;

export function ProductAdmin() {
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, refetch } = useAdminProductsQuery({
    search: term,
    page,
    perPage: PER_PAGE,
  });

  const products = data?.items ?? [];
  const pages = pageCount(data?.total ?? 0, PER_PAGE);

  return (
    <div className="grid gap-4">
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          setTerm(search.trim());
          setPage(1);
        }}
        className="flex gap-2"
      >
        <label className="sr-only" htmlFor="admin-product-search">
          Search products
        </label>
        <input
          id="admin-product-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or slug…"
          className="focus-ring border-card-line/80 text-ink rounded-card min-h-12 w-full max-w-md border px-4 text-base"
        />
        <button
          type="submit"
          className="focus-ring bg-ink hover:bg-cocoa rounded-card min-h-12 shrink-0 px-5 text-sm font-medium text-white transition-colors"
        >
          Search
        </button>
      </form>

      {isError ? (
        <ErrorState
          message={apiErrorMessage(error, "We could not load the catalogue.")}
          onRetry={() => void refetch()}
        />
      ) : isLoading ? (
        <div role="status" aria-label="Loading products" className="grid gap-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-20" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          title="No products found"
          description="Try a different search term."
        />
      ) : (
        <>
          <ul className="grid gap-2">
            {products.map((product) => (
              <ProductRow key={product.id} product={product} />
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

/**
 * One editable row. Price is entered in cedis and converted here — staff think
 * in cedis, the API stores pesewas, and asking anyone to type 12500 for ₵125 is
 * how a product ends up priced at a hundredth of its value.
 */
function ProductRow({ product }: { product: AdminProduct }) {
  const [update, { isLoading }] = useAdminUpdateProductMutation();
  const [price, setPrice] = useState((product.priceMinor / 100).toFixed(2));
  const [stock, setStock] = useState(String(product.stock));
  const [salePrice, setSalePrice] = useState(
    product.salePriceMinor === null ? "" : (product.salePriceMinor / 100).toFixed(2),
  );
  // DatePicker works in YYYY-MM-DD and the API answers with an ISO instant;
  // slicing is the whole conversion in both directions.
  const [saleEnds, setSaleEnds] = useState(product.saleEndsAt?.slice(0, 10) ?? "");
  const [failure, setFailure] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saleOpen, setSaleOpen] = useState(product.salePriceMinor !== null);

  const save = async (patch: Omit<ProductPatch, "productId">) => {
    setFailure(null);
    setSaved(false);
    try {
      await update({ productId: product.id, ...patch }).unwrap();
      setSaved(true);
    } catch (error) {
      setFailure(apiErrorMessage(error, "That change was not saved."));
    }
  };

  const onSave = () => {
    const cedis = Number(price);
    const units = Number(stock);

    if (!Number.isFinite(cedis) || cedis < 0 || !Number.isFinite(units) || units < 0) {
      setFailure("Enter a price and stock of zero or more.");
      return;
    }

    const patch: Omit<ProductPatch, "productId"> = {
      priceMinor: Math.round(cedis * 100),
      stock: Math.round(units),
    };

    const sale = salePrice.trim();

    if (sale.length === 0) {
      // An emptied box means "end the sale", which needs the flag: a field
      // simply left out reads to the API as "leave it alone".
      if (product.salePriceMinor !== null) {
        patch.clearSale = true;
      }
    } else {
      const saleCedis = Number(sale);

      if (!Number.isFinite(saleCedis) || saleCedis <= 0) {
        setFailure("Enter a sale price above zero, or clear the box to end the sale.");
        return;
      }

      if (saleCedis >= cedis) {
        // Caught here as well as on the server so the message arrives next to
        // the box that is wrong.
        setFailure("The sale price must be below the normal price.");
        return;
      }

      patch.salePriceMinor = Math.round(saleCedis * 100);

      if (saleEnds) {
        // End of the chosen day, not its first second: a sale set to end on
        // the 30th should still be running on the morning of the 30th.
        patch.saleEndsAt = new Date(`${saleEnds}T23:59:59Z`).toISOString();
      }
    }

    void save(patch);
  };

  return (
    <li className="border-card-line/70 grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <p className="text-ink truncate font-medium">{product.name}</p>
        <p className="truncate text-xs text-neutral-500">
          {product.slug}
          {!product.active && " · hidden from the shop"}
          {product.onSale && " · on sale"}
        </p>
        {failure && (
          <p role="alert" className="mt-1 text-xs text-red-700">
            {failure}
          </p>
        )}
        {saved && !failure && (
          <p role="status" className="mt-1 text-xs text-emerald-700">
            Saved. Now {formatMoney(product.priceMinor, product.currency)},{" "}
            {product.stock} in stock.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-xs text-neutral-500">
          Price (₵)
          <input
            type="number"
            min={0}
            step="0.01"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            className="focus-ring border-card-line/80 text-ink rounded-card min-h-11 w-28 border px-3 text-base"
          />
        </label>

        <label className="grid gap-1 text-xs text-neutral-500">
          Stock
          <input
            type="number"
            min={0}
            step="1"
            value={stock}
            onChange={(event) => setStock(event.target.value)}
            className="focus-ring border-card-line/80 text-ink rounded-card min-h-11 w-24 border px-3 text-base"
          />
        </label>

        {/* Behind a toggle: most rows are edited for stock, and two more
            always-visible boxes would push the Save button off a laptop. */}
        {saleOpen ? (
          <>
            <label className="grid gap-1 text-xs text-neutral-500">
              Sale price (₵)
              <input
                type="number"
                min={0}
                step="0.01"
                value={salePrice}
                onChange={(event) => setSalePrice(event.target.value)}
                placeholder="none"
                className="focus-ring border-card-line/80 text-ink rounded-card min-h-11 w-28 border px-3 text-base"
              />
            </label>

            <div className="grid gap-1 text-xs text-neutral-500">
              Sale ends
              <DatePicker
                label="Sale ends"
                value={saleEnds}
                onChange={setSaleEnds}
                placeholder="No end date"
                className="w-44"
              />
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setSaleOpen(true)}
            className="focus-ring min-h-11 text-sm underline underline-offset-4"
          >
            Put on sale
          </button>
        )}

        <button
          type="button"
          onClick={onSave}
          disabled={isLoading}
          className="focus-ring bg-ink hover:bg-cocoa rounded-card min-h-11 px-4 text-sm font-medium text-white transition-colors disabled:opacity-50"
        >
          Save
        </button>

        <button
          type="button"
          onClick={() => void save({ active: !product.active })}
          disabled={isLoading}
          aria-pressed={product.active}
          className="focus-ring border-card-line/80 text-ink hover:bg-sand/40 rounded-card min-h-11 border px-4 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {product.active ? "Hide" : "Show"}
        </button>
      </div>
    </li>
  );
}
