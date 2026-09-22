# bodybioticsgh

E-commerce storefront for Ghana, shipped as an installable PWA.

```
frontend/   Next.js 16 PWA — App Router, TypeScript strict, Tailwind v4, RTK Query
backend/    ASP.NET Core 10 API — Minimal APIs, EF Core, PostgreSQL
docs/       setup and architecture reference
docker-compose.yml   postgres + redis for local development
```

The catalogue — 340 products, 34 categories, 105 brands — was imported once from the previous WordPress/WooCommerce site. See [docs/SETUP.md](docs/SETUP.md) §2.5 for how, and what the source data could and could not provide.

- **[docs/SETUP.md](docs/SETUP.md)** — architecture, caching strategy, auth model, CI, iOS/Android differences.
- **[frontend/README.md](frontend/README.md)** — frontend scripts and conventions.

## Getting started

```bash
docker compose up -d postgres redis      # or a local PostgreSQL 16+

# terminal 1 — API on :5080, migrates and seeds itself in Development
cd backend && dotnet run --project src/BodyBiotics.Api

# terminal 2 — PWA on :3000
cd frontend && npm ci && npm run dev
```

The browser only ever talks to the frontend origin; `/api/*` is proxied through Next to the API so the session cookie stays first-party (Safari drops third-party cookies in an installed PWA).

## Checks

```bash
cd backend  && dotnet build && dotnet test          # 157 tests
cd frontend && npm run lint && npm run typecheck && npm test   # 111 tests
cd frontend && npm run build && npm run test:e2e    # production build + Playwright
```
