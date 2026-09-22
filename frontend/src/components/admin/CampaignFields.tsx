"use client";

import { DateField, InputField, SelectField } from "@/components/ui/Field";
import {
  DISCOUNT_TYPES,
  PROMOTION_SCOPES,
  type DiscountType,
  type PromotionScope,
} from "@/lib/features/promotions/promotionsApi";

/**
 * The half of a campaign a coupon and an automatic promotion have in common:
 * what kind of discount it is, what it applies to, and the thresholds that
 * have to be met. Held in one component so the two forms cannot drift into
 * offering different options for the same underlying field.
 *
 * Money is edited in cedis and stored in pesewas. Staff think in cedis, and
 * asking anyone to type 5000 for ₵50 is how a discount ends up a hundred times
 * too large.
 */
export type CampaignValues = {
  description: string;
  discountType: DiscountType;
  scope: PromotionScope;
  scopeSlugs: string;
  /** Percent, or cedis, by type. */
  value: string;
  maxDiscount: string;
  minSpend: string;
  minQuantity: string;
  buyQuantity: string;
  getQuantity: string;
  startsAt: string;
  endsAt: string;
};

export const emptyCampaign: CampaignValues = {
  description: "",
  discountType: "PERCENTAGE",
  scope: "EVERYTHING",
  scopeSlugs: "",
  value: "",
  maxDiscount: "",
  minSpend: "",
  minQuantity: "",
  buyQuantity: "2",
  getQuantity: "1",
  startsAt: "",
  endsAt: "",
};

const toMinor = (cedis: string): number | null => {
  const trimmed = cedis.trim();
  if (trimmed.length === 0) return null;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : null;
};

const toCedis = (minor: number | null): string =>
  minor === null ? "" : (minor / 100).toFixed(2);

const toDate = (iso: string | null): string => iso?.slice(0, 10) ?? "";

/** End of the chosen day: a campaign set to end on the 30th runs all of the 30th. */
const fromDate = (day: string, endOfDay: boolean): string | null =>
  day.length === 0
    ? null
    : new Date(`${day}T${endOfDay ? "23:59:59" : "00:00:00"}Z`).toISOString();

/** Fills the shared fields from a saved campaign. */
export function campaignFrom(saved: {
  description: string;
  discountType: DiscountType;
  scope: PromotionScope;
  scopeSlugs: string | null;
  value: number;
  maxDiscountMinor: number | null;
  minSpendMinor: number;
  minQuantity: number;
  buyQuantity: number;
  getQuantity: number;
  startsAt: string | null;
  endsAt: string | null;
}): CampaignValues {
  return {
    description: saved.description,
    discountType: saved.discountType,
    scope: saved.scope,
    scopeSlugs: saved.scopeSlugs ?? "",
    // A percentage is stored as a percentage; a fixed amount is minor units.
    value:
      saved.discountType === "FIXEDAMOUNT"
        ? toCedis(saved.value)
        : String(saved.value || ""),
    maxDiscount: toCedis(saved.maxDiscountMinor),
    minSpend: saved.minSpendMinor === 0 ? "" : toCedis(saved.minSpendMinor),
    minQuantity: saved.minQuantity === 0 ? "" : String(saved.minQuantity),
    buyQuantity: String(saved.buyQuantity || 2),
    getQuantity: String(saved.getQuantity || 1),
    startsAt: toDate(saved.startsAt),
    endsAt: toDate(saved.endsAt),
  };
}

export type CampaignPayload = {
  description: string;
  discountType: DiscountType;
  scope: PromotionScope;
  scopeSlugs: string | null;
  value: number;
  maxDiscountMinor: number | null;
  minSpendMinor: number;
  minQuantity: number;
  buyQuantity: number;
  getQuantity: number;
  startsAt: string | null;
  endsAt: string | null;
};

/**
 * Turns the form into what the API takes, or returns the first thing wrong
 * with it. The server validates all of this again — this exists so the
 * complaint lands next to the field rather than as a banner after a round-trip.
 */
export function campaignPayload(
  values: CampaignValues,
): { payload: CampaignPayload } | { error: string } {
  if (values.description.trim().length === 0) {
    return { error: "Give the offer a description — customers see it on their basket." };
  }

  let value = 0;

  if (values.discountType === "PERCENTAGE") {
    const percent = Number(values.value);
    if (!Number.isInteger(percent) || percent < 1 || percent > 100) {
      return { error: "A percentage discount is a whole number between 1 and 100." };
    }
    value = percent;
  } else if (values.discountType === "FIXEDAMOUNT") {
    const minor = toMinor(values.value);
    if (minor === null || minor <= 0) {
      return { error: "Enter how much comes off, in cedis." };
    }
    value = minor;
  }

  if (values.scope !== "EVERYTHING" && values.scopeSlugs.trim().length === 0) {
    return { error: "List the slugs this applies to, or set it to apply to everything." };
  }

  const maxDiscountMinor = toMinor(values.maxDiscount);
  const minSpendMinor = toMinor(values.minSpend) ?? 0;

  const minQuantity = values.minQuantity.trim() === "" ? 0 : Number(values.minQuantity);
  if (!Number.isInteger(minQuantity) || minQuantity < 0) {
    return { error: "Minimum items must be a whole number." };
  }

  const buyQuantity = Number(values.buyQuantity);
  const getQuantity = Number(values.getQuantity);

  if (values.discountType === "BUYXGETY") {
    if (!Number.isInteger(buyQuantity) || buyQuantity < 1) {
      return { error: "'Buy' must be at least 1." };
    }
    if (!Number.isInteger(getQuantity) || getQuantity < 1) {
      return { error: "'Get free' must be at least 1." };
    }
  }

  const startsAt = fromDate(values.startsAt, false);
  const endsAt = fromDate(values.endsAt, true);

  if (startsAt && endsAt && endsAt <= startsAt) {
    return { error: "A campaign cannot end before it starts." };
  }

  return {
    payload: {
      description: values.description.trim(),
      discountType: values.discountType,
      scope: values.scope,
      scopeSlugs: values.scopeSlugs.trim() || null,
      value,
      maxDiscountMinor,
      minSpendMinor,
      minQuantity,
      buyQuantity: values.discountType === "BUYXGETY" ? buyQuantity : 0,
      getQuantity: values.discountType === "BUYXGETY" ? getQuantity : 0,
      startsAt,
      endsAt,
    },
  };
}

export function CampaignFields({
  values,
  onChange,
  disabled,
}: {
  values: CampaignValues;
  onChange: (values: CampaignValues) => void;
  disabled?: boolean;
}) {
  const set =
    <K extends keyof CampaignValues>(key: K) =>
    (value: CampaignValues[K]) =>
      onChange({ ...values, [key]: value });

  const isPercentage = values.discountType === "PERCENTAGE";
  const isFixed = values.discountType === "FIXEDAMOUNT";
  const isBuyXGetY = values.discountType === "BUYXGETY";

  return (
    <fieldset className="grid gap-4 sm:grid-cols-2" disabled={disabled}>
      <legend className="sr-only">Offer</legend>

      <InputField
        label="Description"
        value={values.description}
        onChange={(event) => set("description")(event.target.value)}
        hint="Shown on the customer's basket, e.g. “20% off CeraVe”."
        className="sm:col-span-2"
        required
      />

      <SelectField
        label="Kind of discount"
        value={values.discountType}
        onChange={(event) =>
          set("discountType")(event.target.value as CampaignValues["discountType"])
        }
        options={DISCOUNT_TYPES}
      />

      <SelectField
        label="Applies to"
        value={values.scope}
        onChange={(event) => set("scope")(event.target.value as CampaignValues["scope"])}
        options={PROMOTION_SCOPES}
      />

      {values.scope !== "EVERYTHING" && (
        <InputField
          label="Slugs"
          value={values.scopeSlugs}
          onChange={(event) => set("scopeSlugs")(event.target.value)}
          hint="Comma-separated, e.g. cerave, nivea. Matched ignoring case."
          className="sm:col-span-2"
        />
      )}

      {(isPercentage || isFixed) && (
        <InputField
          label={isPercentage ? "Percent off" : "Amount off (₵)"}
          type="number"
          min={isPercentage ? 1 : 0}
          max={isPercentage ? 100 : undefined}
          step={isPercentage ? 1 : "0.01"}
          value={values.value}
          onChange={(event) => set("value")(event.target.value)}
          required
        />
      )}

      {isPercentage && (
        <InputField
          label="Most it can take off (₵)"
          type="number"
          min={0}
          step="0.01"
          value={values.maxDiscount}
          onChange={(event) => set("maxDiscount")(event.target.value)}
          hint="Leave blank for no ceiling."
        />
      )}

      {isBuyXGetY && (
        <>
          <InputField
            label="Buy"
            type="number"
            min={1}
            max={20}
            value={values.buyQuantity}
            onChange={(event) => set("buyQuantity")(event.target.value)}
          />
          <InputField
            label="Get free"
            type="number"
            min={1}
            max={20}
            value={values.getQuantity}
            onChange={(event) => set("getQuantity")(event.target.value)}
            hint="The cheapest qualifying items are the free ones."
          />
        </>
      )}

      <InputField
        label="Minimum spend (₵)"
        type="number"
        min={0}
        step="0.01"
        value={values.minSpend}
        onChange={(event) => set("minSpend")(event.target.value)}
        hint="On the qualifying items. Blank for none."
      />

      <InputField
        label="Minimum items"
        type="number"
        min={0}
        step={1}
        value={values.minQuantity}
        onChange={(event) => set("minQuantity")(event.target.value)}
        hint="Blank for none."
      />

      <DateField
        label="Starts"
        value={values.startsAt}
        max={values.endsAt || undefined}
        onChange={set("startsAt")}
        hint="Blank to start straight away."
      />

      <DateField
        label="Ends"
        value={values.endsAt}
        min={values.startsAt || undefined}
        onChange={set("endsAt")}
        hint="Runs to the end of this day. Blank to run until stopped."
      />
    </fieldset>
  );
}
