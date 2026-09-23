"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { InputField, SelectField, TextareaField } from "@/components/ui/Field";
import { apiErrorMessage } from "@/lib/api/http";
import {
  useAdminCompleteDeliveryMutation,
  useAdminDispatchOrderMutation,
  useAdminFailDeliveryMutation,
  useAdminRecordRefundMutation,
  useAdminUpdateOrderStatusMutation,
} from "@/lib/features/admin/adminApi";
import type { AdminOrder, RefundMethod } from "@/lib/features/admin/adminApi";
import { formatMoney } from "@/lib/utils/money";

type Mode = "dispatch" | "delivered" | "failed" | "refund" | null;

/** Cedis as typed, to pesewas. Null for anything that is not a positive amount. */
const toMinor = (cedis: string): number | null => {
  const value = Number(cedis);
  return cedis.trim() !== "" && Number.isFinite(value) && value > 0
    ? Math.round(value * 100)
    : null;
};

/**
 * What staff can do with an order next, mirroring the server's rules. Each
 * action that needs details — who took it, what was collected, how much went
 * back — opens its own short form rather than being a single click.
 */
export function OrderActions({ order }: { order: AdminOrder }) {
  const [mode, setMode] = useState<Mode>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [updateStatus, { isLoading: isUpdating }] = useAdminUpdateOrderStatusMutation();

  const run = async (action: () => Promise<unknown>) => {
    setFailure(null);
    try {
      await action();
      setMode(null);
    } catch (caught) {
      setFailure(apiErrorMessage(caught, "That change was refused."));
    }
  };

  const setStatus = (status: string) =>
    void run(() => updateStatus({ reference: order.reference, status }).unwrap());

  const unpaid = order.paidAt === null;
  const canDispatch =
    order.status === "PAID" ||
    (order.status === "PENDING" && order.paymentMethod === "ON_DELIVERY");
  const canRefund =
    (order.status === "PAID" || order.status === "FULFILLED") &&
    order.refundableMinor > 0;
  const active = order.deliveries.find((trip) => trip.status === "OUT_FOR_DELIVERY");

  const close = () => {
    setMode(null);
    setFailure(null);
  };

  return (
    <div className="grid gap-3">
      {mode === "dispatch" && (
        <DispatchForm order={order} onDone={run} onCancel={close} />
      )}
      {mode === "delivered" && (
        <DeliveredForm order={order} unpaid={unpaid} onDone={run} onCancel={close} />
      )}
      {mode === "failed" && <FailedForm order={order} onDone={run} onCancel={close} />}
      {mode === "refund" && <RefundForm order={order} onDone={run} onCancel={close} />}

      {mode === null && (
        <>
          {active && (
            <p className="text-sm text-neutral-700">
              Out with <span className="text-ink font-medium">{active.riderName}</span>
              {active.courierName && ` (${active.courierName})`} —{" "}
              <a
                href={`tel:${active.riderPhone.replace(/\s/g, "")}`}
                className="focus-ring underline underline-offset-4"
              >
                {active.riderPhone}
              </a>
            </p>
          )}

          {order.status === "PENDING" && (
            <Button fullWidth disabled={isUpdating} onClick={() => setStatus("paid")}>
              Mark paid
            </Button>
          )}
          {canDispatch && (
            <Button fullWidth onClick={() => setMode("dispatch")}>
              Send out for delivery
            </Button>
          )}
          {order.status === "DISPATCHED" && (
            <>
              <Button fullWidth onClick={() => setMode("delivered")}>
                Mark delivered
              </Button>
              <Button variant="outline" fullWidth onClick={() => setMode("failed")}>
                Delivery failed
              </Button>
            </>
          )}
          {canRefund && (
            <Button variant="outline" fullWidth onClick={() => setMode("refund")}>
              Record refund
            </Button>
          )}
          {order.status === "PENDING" && (
            <Button
              variant="outline"
              fullWidth
              disabled={isUpdating}
              onClick={() => setStatus("cancelled")}
            >
              Cancel order
            </Button>
          )}

          {!canDispatch &&
            !canRefund &&
            order.status !== "PENDING" &&
            order.status !== "DISPATCHED" && (
              <p className="text-sm text-neutral-600">
                This order is finished — there is nothing further to do with it.
              </p>
            )}

          {order.status === "PENDING" && (
            <p className="text-xs text-neutral-500">
              Cancelling returns the reserved stock to the catalogue.
            </p>
          )}
        </>
      )}

      {failure && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {failure}
        </p>
      )}
    </div>
  );
}

type FormProps = {
  order: AdminOrder;
  onDone: (action: () => Promise<unknown>) => Promise<void>;
  onCancel: () => void;
};

function FormShell({
  title,
  submitLabel,
  busy,
  onSubmit,
  onCancel,
  children,
}: {
  title: string;
  submitLabel: string;
  busy: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <h4 className="text-ink font-medium">{title}</h4>
      {children}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy} className="flex-1">
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Back
        </Button>
      </div>
    </form>
  );
}

function DispatchForm({ order, onDone, onCancel }: FormProps) {
  const [dispatch, { isLoading }] = useAdminDispatchOrderMutation();
  const [method, setMethod] = useState<"RIDER" | "COURIER">("RIDER");
  const [riderName, setRiderName] = useState("");
  const [riderPhone, setRiderPhone] = useState("");
  const [courierName, setCourierName] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <FormShell
      title="Send out for delivery"
      submitLabel="Dispatch"
      busy={isLoading}
      onCancel={onCancel}
      onSubmit={() =>
        void onDone(() =>
          dispatch({
            reference: order.reference,
            method,
            riderName: riderName.trim(),
            riderPhone: riderPhone.trim(),
            ...(method === "COURIER" ? { courierName: courierName.trim() } : {}),
            ...(notes.trim() ? { notes: notes.trim() } : {}),
          }).unwrap(),
        )
      }
    >
      <SelectField
        label="Who is taking it"
        value={method}
        onChange={(event) => setMethod(event.target.value as "RIDER" | "COURIER")}
        options={[
          { value: "RIDER", label: "Our rider or driver" },
          { value: "COURIER", label: "A delivery service (Yango, Bolt…)" },
        ]}
      />
      {method === "COURIER" && (
        <InputField
          label="Service"
          value={courierName}
          onChange={(event) => setCourierName(event.target.value)}
          placeholder="Yango"
          required
        />
      )}
      <InputField
        label={method === "COURIER" ? "Driver's name" : "Rider's name"}
        value={riderName}
        onChange={(event) => setRiderName(event.target.value)}
        required
      />
      <InputField
        label="Their phone"
        type="tel"
        value={riderPhone}
        onChange={(event) => setRiderPhone(event.target.value)}
        hint="The customer is emailed this name and number."
        required
      />
      <TextareaField
        label="Notes"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Trip link, plate number…"
        rows={2}
      />
    </FormShell>
  );
}

function DeliveredForm({
  order,
  unpaid,
  onDone,
  onCancel,
}: FormProps & { unpaid: boolean }) {
  const [complete, { isLoading }] = useAdminCompleteDeliveryMutation();
  const [collected, setCollected] = useState((order.totalMinor / 100).toFixed(2));
  const [via, setVia] = useState<"cash" | "mobilemoney">("cash");
  const [error, setError] = useState<string | undefined>();

  return (
    <FormShell
      title="Mark delivered"
      submitLabel="Delivered"
      busy={isLoading}
      onCancel={onCancel}
      onSubmit={() => {
        if (!unpaid) {
          void onDone(() => complete({ reference: order.reference }).unwrap());
          return;
        }

        const collectedMinor = toMinor(collected);
        if (collectedMinor === null) {
          setError("Enter what the rider collected.");
          return;
        }

        setError(undefined);
        void onDone(() =>
          complete({
            reference: order.reference,
            collectedMinor,
            collectedVia: via,
          }).unwrap(),
        );
      }}
    >
      {unpaid ? (
        <>
          <InputField
            label="Collected (₵)"
            type="number"
            min={0}
            step="0.01"
            value={collected}
            onChange={(event) => setCollected(event.target.value)}
            hint={`${formatMoney(order.totalMinor, order.currency)} was due. Delivering also marks it paid.`}
            error={error}
          />
          <SelectField
            label="Paid by"
            value={via}
            onChange={(event) => setVia(event.target.value as "cash" | "mobilemoney")}
            options={[
              { value: "cash", label: "Cash" },
              { value: "mobilemoney", label: "Mobile Money" },
            ]}
          />
        </>
      ) : (
        <p className="text-sm text-neutral-600">
          Already paid online — nothing to collect.
        </p>
      )}
    </FormShell>
  );
}

function FailedForm({ order, onDone, onCancel }: FormProps) {
  const [fail, { isLoading }] = useAdminFailDeliveryMutation();
  const [reason, setReason] = useState("");

  return (
    <FormShell
      title="Delivery failed"
      submitLabel="Bring it back"
      busy={isLoading}
      onCancel={onCancel}
      onSubmit={() =>
        void onDone(() =>
          fail({ reference: order.reference, reason: reason.trim() }).unwrap(),
        )
      }
    >
      <TextareaField
        label="What happened"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Customer not reachable, wrong address…"
        rows={2}
        hint="The order goes back to be sent again or cancelled. The customer is not emailed."
        required
      />
    </FormShell>
  );
}

const REFUND_METHODS: { value: RefundMethod; label: string }[] = [
  { value: "MOBILE_MONEY", label: "Mobile Money" },
  { value: "CASH", label: "Cash" },
  { value: "HUBTEL", label: "Hubtel dashboard" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
];

function RefundForm({ order, onDone, onCancel }: FormProps) {
  const [refund, { isLoading }] = useAdminRecordRefundMutation();
  const [amount, setAmount] = useState((order.refundableMinor / 100).toFixed(2));
  const [method, setMethod] = useState<RefundMethod>("MOBILE_MONEY");
  const [reason, setReason] = useState("");
  const [transactionReference, setTransactionReference] = useState("");
  const [restock, setRestock] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | undefined>();

  return (
    <FormShell
      title="Record refund"
      submitLabel="Record refund"
      busy={isLoading}
      onCancel={onCancel}
      onSubmit={() => {
        const amountMinor = toMinor(amount);
        if (amountMinor === null || amountMinor > order.refundableMinor) {
          setError(
            `Enter an amount up to ${formatMoney(order.refundableMinor, order.currency)}.`,
          );
          return;
        }

        setError(undefined);
        const lines = Object.entries(restock)
          .map(([productId, quantity]) => ({ productId, quantity: Number(quantity) }))
          .filter((line) => Number.isInteger(line.quantity) && line.quantity > 0);

        void onDone(() =>
          refund({
            reference: order.reference,
            amountMinor,
            method,
            reason: reason.trim(),
            ...(transactionReference.trim()
              ? { transactionReference: transactionReference.trim() }
              : {}),
            ...(lines.length > 0 ? { restock: lines } : {}),
          }).unwrap(),
        );
      }}
    >
      {/* Said up front: this button records money already sent. */}
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
        Send the money first — by Mobile Money, cash or from Hubtel&apos;s dashboard. This
        records it and emails the customer; it does not move money.
      </p>
      <InputField
        label="Amount (₵)"
        type="number"
        min={0}
        step="0.01"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        hint={`Up to ${formatMoney(order.refundableMinor, order.currency)}.`}
        error={error}
      />
      <SelectField
        label="Sent by"
        value={method}
        onChange={(event) => setMethod(event.target.value as RefundMethod)}
        options={REFUND_METHODS}
      />
      <InputField
        label="Transaction reference"
        value={transactionReference}
        onChange={(event) => setTransactionReference(event.target.value)}
        hint="So the customer can find it on their statement."
      />
      <TextareaField
        label="Reason"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        rows={2}
        required
      />

      <fieldset className="grid gap-2">
        <legend className="text-ink text-sm font-medium">Back to stock</legend>
        <p className="text-xs text-neutral-500">
          Only what came back unopened and can be sold again.
        </p>
        {order.lines.map((line) => {
          const remaining = line.quantity - line.restockedQuantity;
          return (
            <InputField
              key={line.productId}
              label={`${line.name} (up to ${remaining})`}
              type="number"
              min={0}
              max={remaining}
              step="1"
              value={restock[line.productId] ?? "0"}
              disabled={remaining === 0}
              onChange={(event) =>
                setRestock((current) => ({
                  ...current,
                  [line.productId]: event.target.value,
                }))
              }
            />
          );
        })}
      </fieldset>
    </FormShell>
  );
}
