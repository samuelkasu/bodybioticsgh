"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { InputField, SelectField, TextareaField } from "@/components/ui/Field";
import { apiErrorMessage } from "@/lib/api/http";
import {
  CONTACT_SUBJECTS,
  useSubmitContactMutation,
  type ContactPayload,
  type ContactSubject,
} from "@/lib/features/contact/contactApi";

type FormErrors = Partial<Record<keyof ContactPayload, string>>;

/**
 * The subject starts empty so the control reads "Select Option", as the
 * original's does; the payload only ever leaves with one of the four values.
 */
type FormValues = Omit<ContactPayload, "subject"> & { subject: ContactSubject | "" };

/**
 * Field face from the original: Poppins 18px on translucent white, a 1px
 * hairline, a 12px radius and 59px tall with 20px of side padding.
 */
const FIELD =
  "font-[family-name:var(--font-poppins)] min-h-[59px] rounded-card! border-[#cacaca]/40 bg-white/85 px-5 text-body-lg text-[#383838] placeholder:text-[#383838]/60";

/** Matches the server's rules so the first failure never costs a round-trip. */
export function validateContact(values: FormValues): FormErrors {
  const errors: FormErrors = {};

  if (values.name.trim().length === 0) errors.name = "Tell us your name.";
  if (values.subject === "") errors.subject = "Choose what your message is about.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (values.message.trim().length < 10) {
    errors.message = "Tell us a little more (at least 10 characters).";
  }

  return errors;
}

export function ContactForm() {
  const [submitContact, { isLoading }] = useSubmitContactMutation();

  const [values, setValues] = useState<FormValues>({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    const found = validateContact(values);
    setErrors(found);
    if (Object.keys(found).length > 0 || values.subject === "") return;

    try {
      await submitContact({
        ...values,
        subject: values.subject,
        name: values.name.trim(),
        email: values.email.trim(),
        message: values.message.trim(),
      }).unwrap();

      setSent(true);
      setValues({ name: "", email: "", subject: "", message: "" });
    } catch (error) {
      setSubmitError(apiErrorMessage(error, "We could not send your message."));
    }
  };

  if (sent) {
    return (
      <div role="status" className="bg-brand-lime/20 rounded-xl px-4 py-6 text-center">
        <p className="font-display text-ink text-lg">Message sent</p>
        <p className="text-cocoa mt-1 text-sm">
          We reply within one working day. For anything urgent, WhatsApp is fastest.
        </p>
        <div className="mt-4">
          <Button variant="outline" onClick={() => setSent(false)}>
            Send another message
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="grid gap-4">
      <InputField
        label="Name"
        placeholder="Name"
        hideLabel
        className={FIELD}
        autoComplete="name"
        value={values.name}
        onChange={(event) => setValues({ ...values, name: event.target.value })}
        error={errors.name}
        required
      />

      <InputField
        label="Email"
        placeholder="Email"
        hideLabel
        className={FIELD}
        type="email"
        inputMode="email"
        autoComplete="email"
        value={values.email}
        onChange={(event) => setValues({ ...values, email: event.target.value })}
        error={errors.email}
        required
      />

      <SelectField
        label="Subject"
        hideLabel
        className={`${FIELD} pr-12`}
        value={values.subject}
        onChange={(event) =>
          setValues({ ...values, subject: event.target.value as ContactSubject })
        }
        error={errors.subject}
        options={[
          { value: "", label: "Select Option" },
          ...CONTACT_SUBJECTS.map((subject) => ({
            value: subject.value,
            label: subject.label,
          })),
        ]}
      />

      <TextareaField
        label="Message"
        placeholder="Message"
        hideLabel
        className={`${FIELD} h-[124px] min-h-[124px] py-4`}
        rows={3}
        value={values.message}
        onChange={(event) => setValues({ ...values, message: event.target.value })}
        error={errors.message}
        required
      />

      {submitError && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {submitError}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        fullWidth
        uppercase
        disabled={isLoading}
        className="bg-teal hover:bg-lime hover:text-ink rounded-pill text-body-lg tracking-caps-wide min-h-[67px] border-0 font-[family-name:var(--font-dm-sans)] font-medium! text-[#f6f7f6]!"
      >
        {isLoading ? "Sending…" : "Send Message"}
      </Button>
    </form>
  );
}
