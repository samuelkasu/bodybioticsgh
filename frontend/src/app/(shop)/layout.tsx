import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { CartDrawer } from "@/components/layout/CartDrawer";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Toaster } from "@/components/ui/Toaster";

/**
 * The storefront shell — announcement bar, header, footer and cart drawer.
 *
 * It lives in a route group rather than in the root layout so that the pages
 * which are not the shop can opt out of it. `not-found.tsx` sits at the root,
 * outside this group, and therefore renders on its own: a customer who lands on
 * a dead link gets one clear page rather than a full storefront wrapped around
 * an apology. The group changes no URLs.
 */
export default function ShopLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <AnnouncementBar />
      <SiteHeader />
      <div className="flex flex-1 flex-col">{children}</div>
      <SiteFooter />
      <CartDrawer />
      <Toaster />
    </>
  );
}
