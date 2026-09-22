"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { InputField } from "@/components/ui/Field";
import { site } from "@/lib/site";

/**
 * Where a guest goes to find an order.
 *
 * Until this existed the only route back to an order was the link in the
 * confirmation email, so anyone who deleted it, mistyped their address or
 * simply checked out as a guest had one option left: message the shop and make
 * a person look it up by hand. The reference is on their Mobile Money receipt,
 * so most people can find it in seconds.
 *
 * It only navigates — the order page itself does the lookup and the access
 * check, and answers "no such order" identically whether or not the reference
 * exists, so this cannot be used to discover other people's orders.
 */
export default function TrackOrderPage() {
  const router = useRouter();
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    // References are printed uppercase on receipts and typed however the
    // customer happens to type them.
    const trimmed = reference.trim().toUpperCase();

    if (trimmed.length < 6) {
      setError("Enter the full reference from your confirmation email.");
      return;
    }

    router.push(`/order/${encodeURIComponent(trimmed)}`);
  };

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-10">
      <h1 className="text-2xl">Track your order</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Enter the reference from your confirmation email — it looks like BB-2K4F7Q.
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-6 grid gap-4">
        <InputField
          label="Order reference"
          name="reference"
          value={reference}
          onChange={(event) => {
            setReference(event.target.value);
            setError(undefined);
          }}
          error={error}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          required
        />

        <Button type="submit" size="lg" fullWidth>
          Find my order
        </Button>
      </form>

      <p className="mt-6 text-sm text-neutral-600">
        Cannot find the reference?{" "}
        <a
          href={site.contact.whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="focus-ring underline"
        >
          Message us on WhatsApp
        </a>{" "}
        with the phone number you ordered on and we will look it up.
      </p>
    </main>
  );
}
