import type { Metadata } from "next";
import Link from "next/link";

import { AdminGuard } from "@/components/admin/AdminGuard";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  // Staff screens. Nothing here should ever appear in a search result.
  robots: { index: false, follow: false },
};

const TABS = [
  { href: "/admin", label: "Orders" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/promotions", label: "Promotions" },
  { href: "/admin/coupons", label: "Discount codes" },
];

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <main className="max-w-shell mx-auto w-full flex-1 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <h1 className="font-display text-ink text-2xl sm:text-3xl">Shop admin</h1>
        <nav aria-label="Admin" className="flex gap-4">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="focus-ring text-ink/70 hover:text-ink text-sm font-medium underline-offset-4 hover:underline"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="mt-6">
        <AdminGuard>{children}</AdminGuard>
      </div>
    </main>
  );
}
