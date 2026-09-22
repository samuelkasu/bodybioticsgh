import type { Metadata } from "next";
import { Poppins } from "next/font/google";

import { ResetPasswordForm } from "@/components/account/AuthForms";

export const metadata: Metadata = {
  title: "Choose a new password",
  // A reset link is a credential. Keeping it out of the index also keeps it out
  // of any crawler that follows a link somebody pasted into a public thread.
  robots: { index: false, follow: false },
};

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const CARD = "rounded-card bg-white px-6 pt-7 pb-9 sm:px-9";

/**
 * Where the emailed link lands. One card, not the two-card account band: the
 * only thing to do here is finish the reset, and a Register form alongside it
 * would just be somewhere else to click.
 *
 * The token is read from searchParams on the server, so the page renders with
 * it already in hand and never flashes an empty form.
 */
export default async function ResetPasswordPage({
  searchParams,
}: PageProps<"/account/reset-password">) {
  const { token } = await searchParams;

  return (
    <main
      className={`${poppins.variable} py-section flex-1 bg-[#f7f8fb] px-4 font-[family-name:var(--font-poppins)] sm:px-6`}
    >
      <div className="mx-auto w-full max-w-[560px]">
        <section aria-labelledby="reset-heading" className={CARD}>
          <h1 id="reset-heading" className="mb-4 text-2xl font-semibold text-black">
            Choose a new password
          </h1>
          <ResetPasswordForm token={typeof token === "string" ? token : ""} />
        </section>
      </div>
    </main>
  );
}
