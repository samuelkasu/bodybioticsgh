import type { Metadata } from "next";
import { Poppins } from "next/font/google";

import { RegisterForm } from "@/components/account/AuthForms";

export const metadata: Metadata = { title: "Create account" };

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export default function RegisterPage() {
  return (
    <main
      className={`${poppins.variable} py-section flex-1 bg-[#f7f8fb] px-4 font-[family-name:var(--font-poppins)] sm:px-6`}
    >
      <div className="rounded-card mx-auto w-full max-w-[560px] bg-white px-6 pt-7 pb-9 sm:px-9">
        <h1 className="sr-only">Create an account</h1>
        <RegisterForm />
      </div>
    </main>
  );
}
