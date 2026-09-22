"use client";

import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { useId, useState } from "react";

import { DatePicker } from "@/components/ui/DatePicker";
import { EyeIcon, EyeOffIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/utils/cn";

const CONTROL =
  "focus-ring min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-base text-ink placeholder:text-neutral-400 disabled:bg-neutral-100 aria-[invalid=true]:border-red-500";

type FieldShellProps = {
  label: ReactNode;
  error?: string | undefined;
  hint?: string | undefined;
  controlId: string;
  /** Placeholder-only forms still need the label for assistive tech. */
  hideLabel?: boolean | undefined;
  children: ReactNode;
};

function FieldShell({
  label,
  error,
  hint,
  controlId,
  hideLabel,
  children,
}: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={controlId}
        className={cn("text-ink text-sm font-medium", hideLabel && "sr-only")}
      >
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-neutral-500">{hint}</p>}
      {/* role=alert so a screen reader announces the failure without a focus jump. */}
      {error && (
        <p id={`${controlId}-error`} role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export type InputFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  label: ReactNode;
  error?: string | undefined;
  hint?: string | undefined;
  hideLabel?: boolean | undefined;
};

export function InputField({
  label,
  error,
  hint,
  hideLabel,
  className,
  ...props
}: InputFieldProps) {
  const id = useId();

  return (
    <FieldShell
      label={label}
      error={error}
      hint={hint}
      hideLabel={hideLabel}
      controlId={id}
    >
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(CONTROL, className)}
        {...props}
      />
    </FieldShell>
  );
}

export type DateFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  hint?: string | undefined;
  min?: string | undefined;
  max?: string | undefined;
  placeholder?: string | undefined;
  disabled?: boolean | undefined;
};

/**
 * A labelled DatePicker, so a form field holding a date looks and behaves like
 * the text fields beside it — same label, same hint, same error.
 */
export function DateField({
  label,
  value,
  onChange,
  error,
  hint,
  min,
  max,
  placeholder,
  disabled,
}: DateFieldProps) {
  const id = useId();

  return (
    <FieldShell label={label} error={error} hint={hint} controlId={id}>
      <DatePicker
        id={id}
        label={label}
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        placeholder={placeholder ?? "Pick a date"}
        disabled={disabled ?? false}
        invalid={Boolean(error)}
        describedBy={error ? `${id}-error` : undefined}
      />
    </FieldShell>
  );
}

export type PasswordFieldProps = Omit<InputFieldProps, "type">;

/**
 * Password input with a reveal toggle. Typing a long password blind on a phone
 * is the usual reason a correct password gets rejected, so the eye is on every
 * password field rather than only where it is mistyped most.
 */
export function PasswordField({
  label,
  error,
  hint,
  hideLabel,
  className,
  ...props
}: PasswordFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <FieldShell
      label={label}
      error={error}
      hint={hint}
      hideLabel={hideLabel}
      controlId={id}
    >
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          // Room for the toggle, so a long password never runs under it.
          className={cn(CONTROL, "pr-12", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((shown) => !shown)}
          aria-pressed={visible}
          aria-controls={id}
          // Named rather than "toggle": a screen reader should hear what the
          // press will do, not what the control is.
          aria-label={visible ? "Hide password" : "Show password"}
          className="focus-ring absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-neutral-500 hover:text-black"
        >
          {visible ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
        </button>
      </div>
    </FieldShell>
  );
}

export type TextareaFieldProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "id"
> & {
  label: ReactNode;
  error?: string | undefined;
  hint?: string | undefined;
  hideLabel?: boolean | undefined;
};

export function TextareaField({
  label,
  error,
  hint,
  hideLabel,
  className,
  rows = 5,
  ...props
}: TextareaFieldProps) {
  const id = useId();

  return (
    <FieldShell
      label={label}
      error={error}
      hint={hint}
      hideLabel={hideLabel}
      controlId={id}
    >
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(CONTROL, "min-h-24 py-2", className)}
        {...props}
      />
    </FieldShell>
  );
}

export type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> & {
  label: ReactNode;
  error?: string | undefined;
  hint?: string | undefined;
  hideLabel?: boolean | undefined;
  options: { value: string; label: string }[];
};

export function SelectField({
  label,
  error,
  hint,
  hideLabel,
  options,
  className,
  ...props
}: SelectFieldProps) {
  const id = useId();

  return (
    <FieldShell
      label={label}
      error={error}
      hint={hint}
      hideLabel={hideLabel}
      controlId={id}
    >
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(CONTROL, "select-control", className)}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
