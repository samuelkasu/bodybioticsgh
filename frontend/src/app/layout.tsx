import type { Metadata, Viewport } from "next";
import { Crimson_Pro, Inter_Tight } from "next/font/google";
import localFont from "next/font/local";

import { Splash } from "@/components/layout/Splash";
import { CookieConsent } from "@/components/legal/CookieConsent";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { OfflineBanner } from "@/components/pwa/OfflineBanner";
import { OfflineOrderQueue } from "@/components/pwa/OfflineOrderQueue";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";
import { UpdatePrompt } from "@/components/pwa/UpdatePrompt";
import { JsonLd } from "@/components/seo/JsonLd";
import { clientEnv } from "@/lib/env";
import { OPEN_GRAPH_DEFAULTS, SITE_ORIGIN } from "@/lib/seo";
import { site } from "@/lib/site";
import { StoreProvider } from "@/lib/store/StoreProvider";

import "./globals.css";

// The two faces the original theme used. `display: swap` keeps text visible
// during load, which matters far more on 3G than the flash of fallback.
const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  display: "swap",
});

const crimsonPro = Crimson_Pro({
  variable: "--font-crimson-pro",
  subsets: ["latin"],
  display: "swap",
});

// The archive titles ("All Products") are set in Wahiyang on the original. It
// is not on Google Fonts, so the face ships with the app.
//
// `preload: false` because exactly one element uses it — the <h1> in ShopHero,
// on the archive pages. Declaring the variable here is what makes `font-script`
// work anywhere, but preloading sent 37KB of it with the cart, the checkout and
// every other page that never renders a glyph in it. Without the preload the
// browser fetches it only once it finds text that needs it, and `display: swap`
// means the title is readable in the fallback meanwhile.
const wahiyang = localFont({
  // woff2, not the .ttf it shipped as: same outlines, 78KB down to 24KB.
  src: "./fonts/Wahiyang-Regular.woff2",
  variable: "--font-wahiyang",
  display: "swap",
  preload: false,
});

/**
 * The cedi sign, and nothing else.
 *
 * Every price on the site is "GH₵…", and ₵ is U+20B5 — which Google's slicing
 * puts in Inter Tight's `latin-ext` subset, not `latin`. One glyph on the
 * announcement bar was therefore pulling an 89KB font file on every page: the
 * single largest asset on /shop, and unpreloaded, so it was discovered late
 * and delayed everything queued behind it.
 *
 * This is that same subset cut down to the one codepoint. Listed ahead of the
 * real faces in --font-sans and --font-display, it answers for ₵ and, because
 * its unicode-range covers nothing else, every other character falls through
 * untouched. A latin-ext character elsewhere still fetches the full file.
 */
const cedi = localFont({
  src: "./fonts/InterTight-Cedi.woff2",
  variable: "--font-cedi",
  display: "swap",
  // 1.2KB, on every page, and the first thing a price needs.
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(clientEnv.NEXT_PUBLIC_SITE_URL),
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  // Inherited by every page that does not set its own. Without these a link
  // pasted into WhatsApp — which is how most of this shop's traffic is shared —
  // unfurls as a bare URL with no title, description or picture.
  openGraph: {
    ...OPEN_GRAPH_DEFAULTS,
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
    url: SITE_ORIGIN,
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
  },
  // No `alternates` here on purpose. Metadata is inherited, so a canonical set
  // on the root layout would be adopted by every page that does not override
  // it — pointing /about, /contact and the legal pages at the homepage and
  // asking Google to drop them. Each indexable page declares its own.
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    // iOS has no manifest support for standalone mode; these meta tags are how
    // an added-to-home-screen icon opens without Safari chrome.
    capable: true,
    title: site.shortName,
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: {
    // Stops iOS turning order references and prices into tappable phone links.
    telephone: false,
  },
  other: {
    // Next 16 emits only the standardised `mobile-web-app-capable`. iOS before
    // 18 reads the prefixed name, and without it the app opens in Safari
    // chrome instead of standalone.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Pinch-zoom stays enabled: disabling it is an accessibility failure and
  // Lighthouse flags it.
  maximumScale: 5,
  // viewport-fit=cover plus env(safe-area-inset-*) padding keeps content clear
  // of the notch and home indicator when installed on iOS.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#002526" },
    { media: "(prefers-color-scheme: dark)", color: "#002526" },
  ],
};

/**
 * Identity markup, sent on every page. `sameAs` is what lets Google tie the
 * Instagram and TikTok accounts to the shop rather than treating them as three
 * unrelated things, and the SearchAction is what can earn a search box directly
 * in the result listing.
 */
const ORGANISATION_JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_ORIGIN}/#organization`,
      name: site.name,
      url: SITE_ORIGIN,
      logo: `${SITE_ORIGIN}/icons/icon-512.png`,
      description: site.description,
      email: site.contact.email,
      telephone: site.contact.phone,
      address: {
        "@type": "PostalAddress",
        addressLocality: "Accra",
        addressCountry: "GH",
      },
      sameAs: [site.social.instagram, site.social.tiktok],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_ORIGIN}/#website`,
      url: SITE_ORIGIN,
      name: site.name,
      publisher: { "@id": `${SITE_ORIGIN}/#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_ORIGIN}/shop?search={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-GH"
      className={`${cedi.variable} ${interTight.variable} ${crimsonPro.variable} ${wahiyang.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <JsonLd data={ORGANISATION_JSON_LD} />
        {/* First thing painted; stays up until the page reports itself loaded. */}
        <Splash />
        {/*
          Only the document shell and the app-wide PWA pieces. The storefront
          chrome lives in the (shop) route group, so a page outside it — the
          404 — renders on its own.
        */}
        <StoreProvider>
          <ServiceWorkerRegistrar />
          <OfflineBanner />
          {children}
          <OfflineOrderQueue />
          <InstallPrompt />
          <UpdatePrompt />
          {/* Last in the tree, first on screen: it holds the other bottom
              sheets back until the cookie question is answered. */}
          <CookieConsent />
        </StoreProvider>
      </body>
    </html>
  );
}
