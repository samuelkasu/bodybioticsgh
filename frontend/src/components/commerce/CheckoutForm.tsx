"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { OrderSummary } from "@/components/commerce/OrderSummary";
import { Button } from "@/components/ui/Button";
import { InputField, SelectField, TextareaField } from "@/components/ui/Field";
import { apiErrorMessage } from "@/lib/api/http";
import { loadSavedDetails, saveDetails } from "@/lib/checkout/savedDetails";
import { enqueueOrder } from "@/lib/offline/orderQueue";
import { formatGhanaPhone, isValidGhanaPhone } from "@/lib/utils/phone";
import { formatMoney } from "@/lib/utils/money";
import { leaveApp } from "@/lib/utils/navigate";
import { useGetSessionQuery } from "@/lib/features/auth/authApi";
import {
  useDeliveryOptionsQuery,
  usePaymentMethodsQuery,
  usePlaceOrderMutation,
  type CheckoutPayload,
  type PaymentMethod,
} from "@/lib/features/orders/ordersApi";
import {
  selectCartDiscountedSubtotalMinor,
  selectCartFreeDeliveryGranted,
  selectHasUnavailableLines,
} from "@/lib/features/cart/cartSlice";
import { useAppSelector } from "@/lib/store/hooks";

type FormErrors = Partial<Record<keyof CheckoutPayload, string>>;

/** The order the fields appear in, which is the order failures are reported in. */
const FIELD_ORDER = [
  "fullName",
  "email",
  "phone",
  "addressLine",
  "city",
  "deliveryZone",
] as const;

/** Mirrors the server's FluentValidation rules so the first failure is local. */
export function validateCheckout(
  values: Omit<CheckoutPayload, "requestId" | "paymentMethod">,
): FormErrors {
  const errors: FormErrors = {};

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (values.fullName.trim().length === 0) {
    errors.fullName = "Enter the name for delivery.";
  }
  // Counting digits rather than matching punctuation: 024…, +233 24… and
  // (024) 123-4567 are all the same reachable number, and "+++ (((" is not a
  // number at all even though it satisfies a character-class test.
  if (!isValidGhanaPhone(values.phone)) {
    errors.phone = "Enter a Ghanaian number we can call, e.g. 024 123 4567.";
  }
  if (values.addressLine.trim().length === 0) {
    errors.addressLine = "Enter a delivery address.";
  }
  if (values.city.trim().length === 0) {
    errors.city = "Enter a town or city.";
  }
  if (values.deliveryZone.trim().length === 0) {
    errors.deliveryZone = "Choose the area we are delivering to.";
  }

  return errors;
}

export function CheckoutForm() {
  const router = useRouter();
  const [placeOrder, { isLoading }] = usePlaceOrderMutation();
  const hasUnavailableLines = useAppSelector(selectHasUnavailableLines);
  // The discounted figure, because that is what the server prices delivery
  // against and what it charges. Using the gross subtotal here would put a
  // number on the button that the receipt then contradicts.
  const subtotalMinor = useAppSelector(selectCartDiscountedSubtotalMinor);
  const freeDeliveryGranted = useAppSelector(selectCartFreeDeliveryGranted);

  const { data: delivery } = useDeliveryOptionsQuery();
  const { data: session } = useGetSessionQuery();

  const [values, setValues] = useState({
    email: "",
    fullName: "",
    phone: "",
    addressLine: "",
    city: "",
    notes: "",
    deliveryZone: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Prefilled once, and never over anything already typed. Two sources, in
  // this order: what this device last checked out with, then the signed-in
  // account. A returning customer should be one tap from ordering again, not
  // six fields of retyping on a phone keyboard.
  const [prefilled, setPrefilled] = useState(false);
  useEffect(() => {
    if (prefilled) return;

    const saved = loadSavedDetails();
    const account = session?.user;
    if (!saved && !account) return;

    // localStorage cannot be read while rendering without the server and the
    // first client paint disagreeing, so this has to happen after mount. It
    // runs at most once and never overwrites a field already typed in.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValues((current) => ({
      ...current,
      fullName: current.fullName || saved?.fullName || account?.name || "",
      email: current.email || saved?.email || account?.email || "",
      phone: current.phone || saved?.phone || "",
      addressLine: current.addressLine || saved?.addressLine || "",
      city: current.city || saved?.city || "",
      deliveryZone: current.deliveryZone || saved?.deliveryZone || "",
    }));
    setPrefilled(true);
  }, [prefilled, session]);

  // Whatever the customer picked, priced with the same rules the server will
  // use, so the figure on the button is the figure they are charged. An
  // unrecognised or unset zone shows nothing rather than a guess.
  // `zones?` as well as `delivery?`: a half-written or proxied response must
  // not take the whole checkout page down. Losing the fee line is recoverable,
  // losing the form is a lost order.
  const zones = delivery?.zones ?? [];
  const selectedZone = zones.find((zone) => zone.code === values.deliveryZone) ?? null;
  const threshold = delivery?.freeDeliveryThresholdMinor;
  // An offer that waives delivery outright overrides the threshold, as it does
  // on the server.
  const qualifiesForFree =
    freeDeliveryGranted || (threshold !== undefined && subtotalMinor >= threshold);
  const deliveryFeeMinor = selectedZone
    ? qualifiesForFree
      ? 0
      : selectedZone.feeMinor
    : null;

  // Online payment is offered only when the API says it is configured, so a
  // customer is never sent to a provider that would reject them.
  const { data: methods } = usePaymentMethodsQuery();
  const canPayOnline = methods?.hubtel ?? false;
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("ON_DELIVERY");

  /**
   * Generated once per mount and reused on retry: this is what stops a dropped
   * connection from creating two orders.
   */
  const requestId = useRef(crypto.randomUUID());

  const set = (key: keyof typeof values) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    const found = validateCheckout(values);
    setErrors(found);

    if (Object.keys(found).length > 0) {
      // Six fields on a phone means the failure is usually off-screen above
      // the button that was just pressed. Without this the form appears to do
      // nothing at all.
      const firstBad = FIELD_ORDER.find((field) => found[field]);
      if (firstBad) {
        const control = formRef.current?.querySelector<HTMLElement>(
          `[name="${firstBad}"]`,
        );
        control?.focus();
        control?.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      return;
    }

    // Defensive: the toggle is hidden when online payment is off, but a stale
    // tab could still be holding the old choice.
    const method: PaymentMethod = canPayOnline ? paymentMethod : "ON_DELIVERY";

    const payload = {
      ...values,
      // One shape on every order, so a delivery run reads consistently and
      // nobody dials +233 on one row and 024 on the next.
      phone: formatGhanaPhone(values.phone),
      notes: values.notes.trim() || undefined,
      requestId: requestId.current,
      paymentMethod: method,
    };

    // Written before the request, not after: if the connection drops the
    // order is queued and this page may never see a success, and the next
    // attempt should still start from a filled-in form.
    saveDetails({
      email: payload.email.trim(),
      fullName: payload.fullName.trim(),
      phone: payload.phone,
      addressLine: payload.addressLine.trim(),
      city: payload.city.trim(),
      deliveryZone: payload.deliveryZone,
    });

    try {
      const order = await placeOrder(payload).unwrap();

      if (order.checkoutUrl) {
        // A full navigation, not router.push: this leaves the app for Hubtel's
        // hosted page. The return URL brings them back to /order/<reference>.
        leaveApp(order.checkoutUrl);
        return;
      }

      router.push(`/order/${order.reference}`);
    } catch (error) {
      // FETCH_ERROR is RTK Query's shape for "the request never reached the
      // server": the tunnel dropped, not an order the API refused. Those are
      // the ones worth holding on to — a rejected order would fail identically
      // on every replay.
      const status = (error as { status?: number | string } | undefined)?.status;
      const unreachable = status === "FETCH_ERROR" || status === "TIMEOUT_ERROR";

      // Only pay-on-delivery orders are worth queueing. An online order has to
      // reach Hubtel for a checkout URL, and replaying one hours later would
      // hand the customer a link to pay for something they have given up on.
      if (unreachable && method === "ON_DELIVERY" && (await enqueueOrder(payload))) {
        setQueued(true);
        return;
      }

      setSubmitError(apiErrorMessage(error, "We could not place your order."));
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={(event) => void onSubmit(event)}
      noValidate
      className="grid gap-6 lg:grid-cols-[2fr_1fr]"
    >
      <div className="grid gap-4">
        {/* Offered, never required — guest checkout is how most orders here are
            placed and putting a wall in front of it loses them. `next` brings
            them straight back to a form their account details fill in. */}
        {!session?.user && (
          <p className="border-card-line/80 rounded-card border px-4 py-3 text-sm">
            Been here before?{" "}
            <Link href="/account/login?next=/checkout" className="focus-ring underline">
              Sign in
            </Link>{" "}
            to fill this in from your last order — or just carry on below.
          </p>
        )}

        <fieldset className="grid gap-4" disabled={isLoading}>
          <legend className="sr-only">Delivery details</legend>

          <InputField
            label="Full name"
            name="fullName"
            autoComplete="name"
            value={values.fullName}
            onChange={(event) => set("fullName")(event.target.value)}
            error={errors.fullName}
            required
          />

          <InputField
            label="Email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={values.email}
            onChange={(event) => set("email")(event.target.value)}
            error={errors.email}
            hint="We send your order confirmation here."
            required
          />

          <InputField
            label="Phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={values.phone}
            onChange={(event) => set("phone")(event.target.value)}
            error={errors.phone}
            hint="The rider calls this number on delivery."
            required
          />

          <InputField
            label="Delivery address"
            name="addressLine"
            autoComplete="street-address"
            value={values.addressLine}
            onChange={(event) => set("addressLine")(event.target.value)}
            error={errors.addressLine}
            required
          />

          <InputField
            label="Town or city"
            name="city"
            autoComplete="address-level2"
            value={values.city}
            onChange={(event) => set("city")(event.target.value)}
            error={errors.city}
            required
          />

          {/* The fix for the biggest hole in this checkout: the customer used
              to reach the button without ever being told what delivery costs.
              Choosing an area prices it immediately, in the summary beside
              this and on the button itself. */}
          <SelectField
            label="Delivery area"
            name="deliveryZone"
            value={values.deliveryZone}
            onChange={(event) => set("deliveryZone")(event.target.value)}
            error={errors.deliveryZone}
            hint={
              selectedZone
                ? `${selectedZone.estimate}${
                    qualifiesForFree ? " · free on this order" : ""
                  }`
                : "We price delivery from this."
            }
            required
            options={[
              { value: "", label: "Choose your area…" },
              ...zones.map((zone) => ({
                value: zone.code,
                // The fee is in the option itself: comparing areas should not
                // mean selecting each one in turn to see what it costs.
                label: `${zone.name} — ${
                  qualifiesForFree ? "free" : formatMoney(zone.feeMinor, "GHS")
                }`,
              })),
            ]}
          />

          <TextareaField
            label="Delivery notes (optional)"
            value={values.notes}
            onChange={(event) => set("notes")(event.target.value)}
            hint="Landmarks, gate codes, preferred delivery time."
          />
        </fieldset>

        {canPayOnline && (
          <fieldset className="grid gap-2" disabled={isLoading}>
            <legend className="text-ink mb-1 text-sm font-medium">
              How would you like to pay?
            </legend>

            <PaymentChoice
              value="ON_DELIVERY"
              selected={paymentMethod}
              onSelect={setPaymentMethod}
              title="Pay on delivery"
              detail="Cash or Mobile Money when the rider arrives. We call to confirm first."
            />

            <PaymentChoice
              value="HUBTEL"
              selected={paymentMethod}
              onSelect={setPaymentMethod}
              title="Pay now"
              detail="Mobile Money, card or GHQR through Hubtel. You will be taken to their secure page."
            />
          </fieldset>
        )}

        {submitError && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {submitError}
          </p>
        )}

        {queued && (
          // Not framed as a failure: the order is kept and will go out by
          // itself. Saying "try again" here would produce the duplicate the
          // idempotency key exists to prevent.
          <p
            role="status"
            className="border-olive/30 bg-olive/10 text-ink rounded-lg border px-3 py-2 text-sm"
          >
            You are offline, so your order has been saved on this device. We will send it
            automatically as soon as you have a connection — there is no need to order
            again.
          </p>
        )}
      </div>

      <div>
        <OrderSummary
          deliveryFeeMinor={deliveryFeeMinor}
          deliveryZoneName={selectedZone?.name ?? null}
          action={
            <>
              <Button
                type="submit"
                fullWidth
                size="lg"
                disabled={isLoading || hasUnavailableLines || queued}
              >
                {/* The amount is on the button itself. A customer about to
                    commit should not have to look away from the control they
                    are pressing to find out what it costs. */}
                {isLoading
                  ? "Placing order…"
                  : queued
                    ? "Saved to send"
                    : paymentMethod === "HUBTEL" && canPayOnline
                      ? deliveryFeeMinor === null
                        ? "Continue to payment"
                        : `Pay ${formatMoney(subtotalMinor + deliveryFeeMinor, "GHS")}`
                      : deliveryFeeMinor === null
                        ? "Place order"
                        : `Place order · ${formatMoney(
                            subtotalMinor + deliveryFeeMinor,
                            "GHS",
                          )}`}
              </Button>
              <p className="mt-2 text-center text-xs text-neutral-500">
                {paymentMethod === "HUBTEL" && canPayOnline
                  ? "You will be taken to Hubtel to pay. Your order is held until payment completes."
                  : "Pay on delivery by Mobile Money or cash. We confirm your order by phone."}
              </p>
            </>
          }
        />
      </div>
    </form>
  );
}

/**
 * A radio dressed as a card. The whole block is the hit area — two options on a
 * phone should not need a thumb aimed at a 16px dot.
 */
function PaymentChoice({
  value,
  selected,
  onSelect,
  title,
  detail,
}: {
  value: PaymentMethod;
  selected: PaymentMethod;
  onSelect: (value: PaymentMethod) => void;
  title: string;
  detail: string;
}) {
  const isSelected = selected === value;

  return (
    <label
      className={`focus-within:ring-olive/70 rounded-card flex cursor-pointer gap-3 border p-4 transition-colors focus-within:ring-2 ${
        isSelected ? "border-ink bg-sand/25" : "border-card-line/80 hover:bg-sand/15"
      }`}
    >
      <input
        type="radio"
        name="paymentMethod"
        value={value}
        checked={isSelected}
        onChange={() => onSelect(value)}
        className="accent-ink mt-1 h-4 w-4"
      />
      <span className="grid gap-0.5">
        <span className="text-ink text-sm font-medium">{title}</span>
        <span className="text-xs text-neutral-600">{detail}</span>
      </span>
    </label>
  );
}
