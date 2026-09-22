import type { Metadata } from "next";
import { Poppins } from "next/font/google";

import { LostPasswordForm, RegisterForm } from "@/components/account/AuthForms";

export const metadata: Metadata = { title: "Reset password" };

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const CARD = "rounded-card bg-white px-6 pt-7 pb-9 sm:px-9";

/** Same two-card band as the sign-in page; the left card resets instead. */
export default function LostPasswordPage() {
  return (
    <main
      className={`${poppins.variable} py-section flex-1 bg-[#f7f8fb] px-4 font-[family-name:var(--font-poppins)] sm:px-6`}
    >
      <div className="max-w-wide mx-auto grid w-full items-start gap-8 lg:grid-cols-2">
        <section aria-labelledby="reset-heading" className={CARD}>
          <h1 id="reset-heading" className="sr-only">
            Reset your password
          </h1>
          <LostPasswordForm />
        </section>

        <section aria-labelledby="register-heading" className={CARD}>
          <h2 id="register-heading" className="sr-only">
            Create an account
          </h2>
          <RegisterForm />
        </section>
      </div>
    </main>
  );
}
