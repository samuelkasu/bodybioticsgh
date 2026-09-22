"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { InputField, PasswordField } from "@/components/ui/Field";
import { apiErrorMessage } from "@/lib/api/http";
import { site } from "@/lib/site";
import {
  useForgotPasswordMutation,
  useLoginMutation,
  useRegisterMutation,
  useResetPasswordMutation,
} from "@/lib/features/auth/authApi";

/**
 * Card faces taken from the original My Account page: 15px labels with a red
 * asterisk, 16px inputs in a hairline box, and a black pill submit that turns
 * lime on hover.
 */
const CONTROL =
  "min-h-[50px] rounded-md border-neutral-200 bg-white px-4 text-base text-black";

const SUBMIT =
  "rounded-full bg-black px-8 py-4 text-base font-bold hover:bg-lime hover:text-black";

/** The original marks every required field with a red asterisk. */
function Required({ children }: { children: string }) {
  return (
    <>
      {children} <span className="text-[#ff0000]">*</span>
    </>
  );
}

/** Matches the server: length beats composition rules on a phone keyboard. */
export const MIN_PASSWORD_LENGTH = 10;

export function validateCredentials(
  email: string,
  password: string,
  { requireStrongPassword }: { requireStrongPassword: boolean },
): { email?: string; password?: string } {
  const errors: { email?: string; password?: string } = {};

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (password.length === 0) {
    errors.password = "Enter your password.";
  } else if (requireStrongPassword && password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  return errors;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [login, { isLoading }] = useLoginMutation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    const found = validateCredentials(email, password, { requireStrongPassword: false });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    try {
      await login({ email: email.trim(), password }).unwrap();
      // Return the customer to whatever sent them here — usually checkout.
      router.push(searchParams.get("next") ?? "/account");
    } catch (error) {
      setSubmitError(apiErrorMessage(error, "We could not sign you in."));
    }
  };

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="grid gap-4">
      <InputField
        label={<Required>Username or email address</Required>}
        className={CONTROL}
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={errors.email}
        required
      />
      <PasswordField
        label={<Required>Password</Required>}
        className={CONTROL}
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={errors.password}
        required
      />

      {submitError && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {submitError}
        </p>
      )}

      <div className="mt-3">
        <Button type="submit" size="lg" className={SUBMIT} disabled={isLoading}>
          {isLoading ? "Signing in…" : "Log in"}
        </Button>
      </div>

      <p className="text-base">
        <Link
          href="/account/lost-password"
          className="focus-ring inline-block py-1.5 text-[#707070] underline hover:text-black"
        >
          Lost your password?
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [register, { isLoading }] = useRegisterMutation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    const found = validateCredentials(email, password, { requireStrongPassword: true });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    try {
      await register({ email: email.trim(), password }).unwrap();
      router.push("/account");
    } catch (error) {
      setSubmitError(apiErrorMessage(error, "We could not create your account."));
    }
  };

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="grid gap-4">
      <InputField
        label={<Required>Email address</Required>}
        className={CONTROL}
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={errors.email}
        required
      />
      <PasswordField
        label={<Required>Password</Required>}
        className={CONTROL}
        autoComplete="new-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={errors.password}
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        required
      />

      {submitError && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {submitError}
        </p>
      )}

      <p className="text-meta text-[#4c4c4d]">
        Your personal data will be used to support your experience throughout this
        website, to manage access to your account, and for other purposes described in our{" "}
        <Link href="/privacy" className="focus-ring text-[#3a3a3a] underline">
          privacy policy
        </Link>
        .
      </p>

      <div className="mt-3">
        <Button type="submit" size="lg" className={SUBMIT} disabled={isLoading}>
          {isLoading ? "Creating account…" : "Register"}
        </Button>
      </div>
    </form>
  );
}

/**
 * Lost-password card. Posts to the API, which sends a single-use link.
 *
 * The confirmation is deliberately the same whether or not the address has an
 * account — the API will not say which, and echoing "no such account" here
 * would turn this form into a way of listing the shop's customers. If mail is
 * not configured at all the API says so, and the WhatsApp fallback below gives
 * the customer somewhere to go rather than a dead end.
 */
export function LostPasswordForm() {
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation();

  const [account, setAccount] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.trim())) {
      setError("Enter the email address on your account.");
      return;
    }

    setError(undefined);

    try {
      await forgotPassword({ email: account.trim() }).unwrap();
      setRequested(true);
    } catch (caught) {
      setSubmitError(apiErrorMessage(caught, "We could not send the reset link."));
    }
  };

  const message = `Hello Body Biotics, please reset the password for my account: ${account.trim()}`;
  const whatsapp = `${site.contact.whatsapp}?text=${encodeURIComponent(message)}`;

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="grid gap-4">
      <p className="text-base leading-relaxed text-black">
        Lost your password? Please enter your email address. You will receive a link to
        create a new password via email.
      </p>

      <InputField
        label={<Required>Email address</Required>}
        className={CONTROL}
        type="email"
        inputMode="email"
        autoComplete="email"
        value={account}
        onChange={(event) => setAccount(event.target.value)}
        error={error}
        required
      />

      {requested && (
        <p
          role="status"
          className="text-meta rounded-lg bg-[#f2f8ec] px-3 py-2 text-[#2f4f1f]"
        >
          If that address has an account, a reset link is on its way. It expires in an
          hour, and it only works once. Check your spam folder if it has not arrived.
        </p>
      )}

      {submitError && (
        <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          <p>{submitError}</p>
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring mt-2 inline-block underline"
          >
            Ask us on WhatsApp instead
          </a>
        </div>
      )}

      <div className="mt-3">
        <Button type="submit" size="lg" className={SUBMIT} disabled={isLoading}>
          {isLoading ? "Sending…" : "Reset password"}
        </Button>
      </div>

      <p className="text-base">
        <Link
          href="/account/login"
          className="focus-ring text-[#707070] underline hover:text-black"
        >
          Have Account? Login now
        </Link>
      </p>
    </form>
  );
}

/**
 * The other half: the page the emailed link lands on.
 *
 * A successful reset signs the customer in server-side, so this pushes them
 * straight into the account rather than back to a login form — they have just
 * chosen a password and typing it again is where people give up.
 */
export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [resetPassword, { isLoading }] = useResetPasswordMutation();

  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirmation?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (token.length === 0) {
    return (
      <div className="grid gap-4">
        <p role="alert" className="text-base leading-relaxed text-black">
          This link is missing its reset code. Ask for a new one and use the most recent
          email.
        </p>
        <p className="text-base">
          <Link
            href="/account/lost-password"
            className="focus-ring text-[#3a3a3a] underline"
          >
            Request a new link
          </Link>
        </p>
      </div>
    );
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    const found: { password?: string; confirmation?: string } = {};

    if (password.length < MIN_PASSWORD_LENGTH) {
      found.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    }

    // Checked here rather than server-side: the server only ever sees one of
    // them, and a typo would otherwise lock the customer out of the account
    // they just recovered.
    if (confirmation !== password) {
      found.confirmation = "Both passwords must match.";
    }

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    try {
      await resetPassword({ token, password }).unwrap();
      router.push("/account");
    } catch (caught) {
      setSubmitError(apiErrorMessage(caught, "We could not reset your password."));
    }
  };

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="grid gap-4">
      <p className="text-base leading-relaxed text-black">
        Choose a new password. Signing in again on your other devices will be needed
        afterwards.
      </p>

      <PasswordField
        label={<Required>New password</Required>}
        className={CONTROL}
        autoComplete="new-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={errors.password}
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        required
      />
      <PasswordField
        label={<Required>Repeat new password</Required>}
        className={CONTROL}
        autoComplete="new-password"
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
        error={errors.confirmation}
        required
      />

      {submitError && (
        <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          <p>{submitError}</p>
          <Link
            href="/account/lost-password"
            className="focus-ring mt-2 inline-block underline"
          >
            Request a new link
          </Link>
        </div>
      )}

      <div className="mt-3">
        <Button type="submit" size="lg" className={SUBMIT} disabled={isLoading}>
          {isLoading ? "Saving…" : "Save new password"}
        </Button>
      </div>
    </form>
  );
}
