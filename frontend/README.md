# bodybioticsgh

E-commerce storefront for Ghana, shipped as an installable PWA.

Next.js 16 (App Router) · TypeScript strict · Tailwind v4 · Redux Toolkit + RTK Query · Serwist service worker · Jest + Playwright.

The API lives in [../backend](../backend) (ASP.NET Core 10). This app serves no API routes; `/api/*` is proxied there by `next.config.ts` so the session cookie stays first-party.

**[docs/SETUP.md](docs/SETUP.md) is the architecture and tooling reference** — read it before adding a feature. It covers caching strategy, auth, env handling, CI, and the iOS/Android differences.

## Quick start

```bash
npm ci
cp .env.example .env.local
npm run db:up                 # postgres + redis
npm run api                   # the .NET API on :5080 (or run it from backend/)
npm run dev
```

The service worker only exists in a production build:

```bash
npm run build && npm start
```

## Scripts

| command                     | what it does                                                         |
| --------------------------- | -------------------------------------------------------------------- |
| `npm run dev`               | dev server on http://localhost:3000                                  |
| `npm run build`             | `next build`, then `serwist build` for the service worker            |
| `npm start`                 | serve the production build                                           |
| `npm run lint`              | eslint (formatting rules off, prettier owns those)                   |
| `npm run format`            | prettier --write (`format:check` in CI)                              |
| `npm run typecheck`         | `tsc --noEmit`                                                       |
| `npm test`                  | jest (`test:watch`, `test:coverage`)                                 |
| `npm run test:e2e`          | playwright against a production build (`test:e2e:ui` for the runner) |
| `npm run db:up` / `db:down` | docker compose postgres + redis                                      |
| `npm run api`               | run the .NET API on :5080 without leaving this folder                |
| `npm run icons -- <file>`   | regenerate PWA icons from a source logo                              |
| `npm run import:catalog`    | re-import the old WooCommerce mirror (see docs/SETUP.md §2.5)        |

## Layout

```
src/
  app/                      routes: /, shop, product, category, brand, cart,
                            checkout, order, account, about, contact, offline
  components/
    commerce/               cards, grid, filters, cart, checkout, orders
    layout/                 header, nav, cart drawer, footer
    home/                   hero, selling points, testimonials
    ui/                     button, fields, skeleton, empty and error states
    pwa/                    install, update, offline, SW registration
  lib/
    api/                    baseApi (RTK Query) + http (server response envelope)
    auth/                   cookie names shared with the API
    env.ts                  zod-validated environment
    features/<domain>/      slice, endpoints, types
    store/                  store, typed hooks, provider
  proxy.ts                  route protection (Next 16 renamed middleware → proxy)
  test/                     renderWithProviders + RTL re-exports
e2e/                        playwright specs
docs/SETUP.md               full setup and architecture guide
```

## Conventions

- Server data goes through RTK Query; add endpoints with `baseApi.injectEndpoints`, never a second api instance.
- Client-only state lives in a slice under `src/lib/features/*` and is read through exported selectors.
- The API answers `{ data }` or `{ error }`; `baseApi` unwraps it, and `isApiError`/`apiErrorMessage` in `src/lib/api/http.ts` narrow the failure case.
- Money is stored and passed around in minor units (pesewas) as integers; format only at render.
- `makeStore()` gives a fresh store per request and per test.
