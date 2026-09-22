import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { Suspense } from "react";

import { LoginForm, RegisterForm } from "@/components/account/AuthForms";
import { Skeleton } from "@/components/ui/Feedback";

export const metadata: Metadata = { title: "Sign in" };

// The original sets both account cards in Poppins.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const CARD = "rounded-card bg-white px-6 pt-7 pb-9 sm:px-9";

/**
 * Log in beside Register on a #F7F8FB band, as on the original My Account page.
 */
export default function LoginPage() {
  return (
    <main
      className={`${poppins.variable} py-section flex-1 bg-[#f7f8fb] px-4 font-[family-name:var(--font-poppins)] sm:px-6`}
    >
      <div className="max-w-wide mx-auto grid w-full items-start gap-8 lg:grid-cols-2">
        <section aria-labelledby="login-heading" className={CARD}>
          <h1 id="login-heading" className="sr-only">
            Sign in
          </h1>
          {/* useSearchParams for the ?next= redirect needs a boundary. */}
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <LoginForm />
          </Suspense>
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
