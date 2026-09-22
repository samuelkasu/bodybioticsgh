import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offline",
};

/**
 * Service-worker navigation fallback (see fallbacks in src/app/sw.ts). It must
 * be fully static — no data fetching — because it renders precisely when the
 * network is gone.
 */
export default function OfflinePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-2xl font-semibold">You are offline</h1>
      <p className="max-w-sm text-neutral-600">
        Pages you have already visited are still available. Anything new needs a
        connection.
      </p>
    </main>
  );
}
