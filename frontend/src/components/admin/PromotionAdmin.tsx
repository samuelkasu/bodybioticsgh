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
import {
  useAdminCreatePromotionMutation,
  useAdminDeletePromotionMutation,
  useAdminPromotionsQuery,
  useAdminUpdatePromotionMutation,
  type AdminPromotion,
} from "@/lib/features/promotions/promotionsApi";
import { formatMoney } from "@/lib/utils/money";

type PromotionValues = CampaignValues & {
  name: string;
  bannerText: string;
  priority: string;
  stackable: boolean;
  active: boolean;
};

const emptyPromotion: PromotionValues = {
  ...emptyCampaign,
  name: "",
  bannerText: "",
  priority: "0",
  stackable: true,
  active: true,
};

const valuesFrom = (promotion: AdminPromotion): PromotionValues => ({
  ...campaignFrom(promotion),
  name: promotion.name,
  bannerText: promotion.bannerText ?? "",
  priority: String(promotion.priority),
  stackable: promotion.stackable,
  active: promotion.active,
});

/**
 * Automatic basket rules: no code, applied to whoever qualifies. The shop's
 * standing free-delivery threshold is the same idea, and anything set up here
 * runs alongside it.
 */
export function PromotionAdmin() {
  const { data, isLoading, isError, error, refetch } = useAdminPromotionsQuery();
  const [editing, setEditing] = useState<string | "new" | null>(null);

  const promotions = data ?? [];

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-sm text-neutral-600">
          Offers that apply by themselves. Customers do not type anything — a basket that
          qualifies is discounted at checkout.
        </p>
        <Button onClick={() => setEditing(editing === "new" ? null : "new")}>
          {editing === "new" ? "Cancel" : "New promotion"}
        </Button>
      </div>

      {editing === "new" && (
        <PromotionForm initial={emptyPromotion} onDone={() => setEditing(null)} />
      )}

      {isError ? (
        <ErrorState
          message={apiErrorMessage(error, "We could not load the promotions.")}
          onRetry={() => void refetch()}
        />
      ) : isLoading ? (
        <div role="status" aria-label="Loading promotions" className="grid gap-2">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
      ) : promotions.length === 0 ? (
        <EmptyState
          title="No promotions yet"
          description="Create one to run an offer without a code."
        />
      ) : (
        <ul className="grid gap-2">
          {promotions.map((promotion) => (
            <PromotionRow
              key={promotion.id}
              promotion={promotion}
              isEditing={editing === promotion.id}
              onToggle={() => setEditing(editing === promotion.id ? null : promotion.id)}
              onDone={() => setEditing(null)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function PromotionRow({
  promotion,
  isEditing,
  onToggle,
  onDone,
}: {
  promotion: AdminPromotion;
  isEditing: boolean;
  onToggle: () => void;
  onDone: () => void;
}) {
  const [remove, { isLoading: isRemoving }] = useAdminDeletePromotionMutation();
  const [failure, setFailure] = useState<string | null>(null);

  const onDelete = async () => {
    setFailure(null);
    try {
      await remove(promotion.id).unwrap();
    } catch (error) {
      setFailure(apiErrorMessage(error, "That promotion was not deleted."));
    }
  };

  return (
    <li className="border-card-line/70 grid gap-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ink font-medium">
            {promotion.name}{" "}
            <span className="text-xs font-normal text-neutral-500">
              {promotion.isLive ? "· live" : promotion.active ? "· scheduled" : "· off"}
            </span>
          </p>
          <p className="text-sm text-neutral-600">{describe(promotion)}</p>
          {promotion.bannerText && (
            <p className="mt-1 text-xs text-neutral-500">
              Banner: “{promotion.bannerText}”
            </p>
          )}
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
            Delete
          </Button>
        </div>
      </div>

      {failure && (
        <p role="alert" className="text-sm text-red-700">
          {failure}
        </p>
      )}

      {isEditing && (
        <PromotionForm
          id={promotion.id}
          initial={valuesFrom(promotion)}
          onDone={onDone}
        />
      )}
    </li>
  );
}

/** One readable line for the list, so staff do not have to open each one. */
function describe(promotion: AdminPromotion): string {
  const what =
    promotion.discountType === "PERCENTAGE"
      ? `${promotion.value}% off`
      : promotion.discountType === "FIXEDAMOUNT"
        ? `${formatMoney(promotion.value, "GHS")} off`
        : promotion.discountType === "FREEDELIVERY"
          ? "Free delivery"
          : `Buy ${promotion.buyQuantity} get ${promotion.getQuantity} free`;

  const where =
    promotion.scope === "EVERYTHING"
      ? "everything"
      : `${promotion.scope.toLowerCase()}: ${promotion.scopeSlugs ?? ""}`;

  const minimum =
    promotion.minSpendMinor > 0
      ? `, over ${formatMoney(promotion.minSpendMinor, "GHS")}`
      : "";

  return `${what} on ${where}${minimum}`;
}

function PromotionForm({
  id,
  initial,
  onDone,
}: {
  id?: string;
  initial: PromotionValues;
  onDone: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [failure, setFailure] = useState<string | null>(null);

  const [create, { isLoading: isCreating }] = useAdminCreatePromotionMutation();
  const [update, { isLoading: isUpdating }] = useAdminUpdatePromotionMutation();

  const busy = isCreating || isUpdating;

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFailure(null);

    if (values.name.trim().length === 0) {
      setFailure("Give the promotion a name so you can find it again.");
      return;
    }

    const priority = Number(values.priority);
    if (!Number.isInteger(priority) || priority < 0) {
      setFailure("Order must be a whole number of zero or more.");
      return;
    }

    const result = campaignPayload(values);
    if ("error" in result) {
      setFailure(result.error);
      return;
    }

    const body = {
      ...result.payload,
      name: values.name.trim(),
      bannerText: values.bannerText.trim() || null,
      priority,
      stackable: values.stackable,
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
      setFailure(apiErrorMessage(error, "That promotion was not saved."));
    }
  };

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      noValidate
      className="border-card-line/70 grid gap-4 rounded-xl border p-4"
    >
      <InputField
        label="Name"
        value={values.name}
        onChange={(event) => setValues({ ...values, name: event.target.value })}
        hint="For your own list. Customers never see this."
        required
      />

      <CampaignFields
        values={values}
        onChange={(next) => setValues({ ...values, ...next })}
        disabled={busy}
      />

      <InputField
        label="Announcement bar text"
        value={values.bannerText}
        onChange={(event) => setValues({ ...values, bannerText: event.target.value })}
        hint="Scrolls above the header while this runs. Blank to say nothing."
      />

      <InputField
        label="Order"
        type="number"
        min={0}
        value={values.priority}
        onChange={(event) => setValues({ ...values, priority: event.target.value })}
        hint="Lower runs first. Matters when two offers apply to the same basket."
      />

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={!values.stackable}
          onChange={(event) => setValues({ ...values, stackable: !event.target.checked })}
          className="accent-ink mt-0.5 h-4 w-4"
        />
        <span>
          Cannot be combined with other offers
          <span className="block text-xs text-neutral-500">
            Once this applies, no further promotion and no discount code will.
          </span>
        </span>
      </label>

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
          {busy ? "Saving…" : id ? "Save changes" : "Create promotion"}
        </Button>
        <Button type="button" variant="outline" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
