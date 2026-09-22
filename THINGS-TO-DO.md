# Things to do

What is left before Body Biotics GH can take a real order from a real customer. Written 2026-09-17 against the current tree, not against `docs/SETUP.md` §8 — that section is stale (cart and checkout are built now).

Ordered by what blocks what. Tick items as they land.

---

## Where this stands — 2026-09-18

**Two numbers, because "complete" depends on what you mean.**

| Toward…                                                    |     |
| ---------------------------------------------------------- | --- |
| **Going live as it trades today** (pay on delivery)        | **85%** |
| **The full system** (card and Mobile Money payments too)   | **80%** |

The product is largely built. The gap is deployment, not features.

| Area                                          | Done | What is missing                                       |
| --------------------------------------------- | ---- | ----------------------------------------------------- |
| Storefront, catalogue, cart, PWA               | 100% | —                                                      |
| SEO and structured data                        | 95%  | the real domain in `NEXT_PUBLIC_SITE_URL`             |
| Checkout and orders                            | 90%  | delivery is not priced                                 |
| Admin and daily operations                     | 100% | —                                                      |
| Security and hardening                         | 85%  | EXIF, `AllowedHosts`, proxy address at deploy          |
| Customer comms (email, password reset)         | 90%  | SMTP credentials from whichever provider you pick      |
| Deployment, secrets, monitoring                | 10%  | nothing exists outside local dev                       |
| Payments (Hubtel)                              | 80%  | credentials, plus 5 items in §1.1 — see the breakdown   |

### Before the domain points at it

Two of these would stop a deploy dead:

1. **The API will not start.** `appsettings.json` has `SeedAdminPassword: "123456789"` — nine characters, and `AppOptions` requires twelve, so `ValidateOnStart` fails before anything else runs. Use `dotnet user-secrets` locally and an environment variable in production; leave a 12-character placeholder in the file.
2. **`NEXT_PUBLIC_SITE_URL` is still `http://localhost:3000`.** It is inlined at build time and feeds every canonical tag, the sitemap, robots.txt and the JSON-LD. Deploy without changing it and Google is told the whole catalogue lives on localhost.

Then, genuinely blocking:

- Somewhere to deploy, with secrets — connection string, `App__TrustedProxies__0`, `AllowedHosts`, HTTPS (§3).
- **SMTP credentials** (§2.2). Email is built and wired end to end, but sends nothing until `Email:Host` and `Email:FromAddress` are set. Until then: enquiries only reach the log, no customer gets a confirmation, and password reset refuses rather than pretending.
- A delivery price, or an explicit decision to quote it on the confirmation call (§1.3).
- Review photos off the container's disk, if reviews are on at launch (§2.4).
- A smoke test on a real iPhone (§5).

Not blocking: automatic stock expiry, Play Store listing, analytics, CDN, Redis rate limiting (that one only matters past one instance). Hubtel is built but switched off until credentials are set — the shop falls back to pay on delivery on its own.

### Done so far (2026-09-17)

- §1.4, §1.5, §4.5.1, §4.5.3 — the order-code cleanup.
- §4.5.2, §4.5.4 (partly), §4.5.5 — the rest of the security section, bar EXIF stripping.
- §2.1 the admin surface, and with it the manual half of §1.2.
- Error pages, SEO, the wishlist, the offline order queue, and Lighthouse budgets in CI.
- A standalone 404 with the shop's own artwork: the storefront chrome moved into a `(shop)` route group so the page renders with no header or footer. URLs are unchanged.
- The home page stockist strip now slides continuously as a pure-CSS marquee, logos 10% larger.
- §1.1 **Hubtel Online Checkout**, with pay on delivery kept alongside it. Off until credentials are set.
- §2.2 **email** and §2.3 **password reset**, both end to end. Off until SMTP credentials are set, and everything degrades cleanly without them.
- **Delivery details are now stored on the order.** They were collected, validated and thrown away — an order that arrived could not be delivered or even phoned about. See §5.

Backend: 157 tests pass. Frontend: 111 unit tests, 5 PWA e2e on a production build, lint and types clean. CI's `format:check` is red on two files that predate this work (`scripts/import-catalog.ts`, `src/components/ui/Feedback.tsx`) — `npm run format` clears it.

**Blocked on a decision, not on work:** §1.3 delivery pricing (needs the actual fees), §2.4 review photo storage (needs a bucket), §4.5.4 EXIF stripping (imaging library licence).

**§2.2 is no longer one of them.** It is built against plain SMTP, which Resend, Brevo, Zoho, Mailgun and SendGrid all speak — so picking a provider is now filling in five settings, not writing code.

---

## 1. Blocks taking money

### 1.1 Payments — BUILT 2026-09-17, needs credentials

Hubtel Online Checkout, chosen over the direct Receive Money prompt so card details never touch this server and the shop stays out of PCI scope. Pay on delivery is kept alongside it.

- [x] `PaymentMethod`, `PaymentReference`, `PaymentCheckoutUrl`, `PaymentChannel`, `PaidAt` on `Order`, with a migration.
- [x] `POST /api/checkout` takes `paymentMethod` and returns a `checkoutUrl` for online orders. The provider is called **after** the database transaction commits — an HTTP round-trip while holding row locks on stock would let a slow gateway stall every other checkout.
- [x] `POST /api/payments/hubtel/callback/{secret}` — and the callback body is never believed. Hubtel signs nothing, so the handler uses it only to learn which reference to ask about, then calls Hubtel's own status endpoint. That answer is what moves an order to Paid.
- [x] The amount is compared against the order before settling. A provider reporting a smaller figure leaves the order unpaid and logs an error rather than quietly fulfilling it.
- [x] Idempotent throughout: a retried callback, a double-clicked Cancel and the order page polling all land in the same place.
- [x] Return leg: `/order/[reference]` polls every 4s while a Hubtel order is Pending, and stops the moment it settles. This is also the safety net for a callback that is late, lost or firewalled.
- [x] Failed payment → order cancelled, stock released. Unreachable provider at checkout → the order is cancelled immediately and the customer told plainly that nothing has been charged.
- [x] `GET /api/payments/methods` so the checkout only offers online payment when it is actually configured.
- [ ] **Put the real credentials in.** Nothing works until `Hubtel:ClientId`, `Hubtel:ClientSecret`, `Hubtel:MerchantAccountNumber` and `Hubtel:CallbackSecret` are set — until then the API reports `hubtel: false` and the shop keeps taking pay-on-delivery orders, which is the intended fallback.
- [ ] **Confirm two details against your Hubtel dashboard.** The status endpoint's host and path, and whether it wants a separate API ID/key pair from the checkout one (`Hubtel:StatusApiId` / `Hubtel:StatusApiKey` exist for exactly that). Both base URLs are configuration, so a moved endpoint is a config change rather than a redeploy.
- [ ] **Make the callback URL publicly reachable.** There is nothing to register in Hubtel's dashboard — Online Checkout takes `callbackUrl` in each initiate request, and the API builds it from `Hubtel:PublicApiUrl`. So that setting must be the real public origin of the API, not localhost. Locally, callbacks cannot reach you at all; that is fine, because the order page reconciles by calling Hubtel outbound, so a local test still settles.
- [ ] Test with a real transaction before launch — a small live payment, then refund it.

#### Still to build (mine, not yours)

Ordered by what would bite first. The first two are worth closing **before any live transaction**.

- [ ] **The cancellation return is not handled.** Hubtel's `cancellationUrl` points at `/checkout?cancelled=<reference>` and nothing reads that parameter. A customer who backs out of the payment page lands on the checkout with no explanation, and their order sits `Pending` holding stock. Small fix: read the parameter, say what happened, and offer to pay again or switch to pay on delivery.
- [ ] **Abandoned online payments never expire** — see §1.2, which this now unblocks. An order where the customer never paid should release its stock after a short window. This is a symptom you would not notice for a week: the catalogue says sold out while the shelf is full.
- [ ] **No reconciliation sweep.** The order page polling covers a late callback only while the customer is watching it. If the callback is missed *and* they never reopen the page, the order never settles. A scheduled job re-checking `Pending` Hubtel orders from the last day closes it.
- [ ] **Refunds do not move money.** Admin "Refund" changes the status here and calls nothing. Whoever refunds must also do it in Hubtel's dashboard, or the two records disagree. Either wire Hubtel's refund API or relabel the button so it is plainly a bookkeeping action.
- [ ] **No automated test of the real flow.** The unit tests run against a fake gateway, which proves the logic and nothing about Hubtel. A sandbox transaction in `frontend/e2e/api.spec.ts` would need test credentials from Hubtel.

**Not needed, in case anyone suggests it:** no CSP change. The hosted checkout is a full navigation, not an iframe, so `frame-src` and `script-src` stay as they are. That would change if the Hubtel modal SDK were ever used instead.

### 1.2 Stock is reserved and never released — PARTLY FIXED 2026-09-17

Checkout decrements stock. Nothing ever gives it back, because nothing cancels an order. Every abandoned checkout permanently removes inventory.

- [x] Cancelling an order from the admin surface returns its stock. That covers the real case today: staff ring the customer, the order falls through, they cancel it.
- [ ] **Expire abandoned Hubtel orders.** Now unblocked by §1.1, and the distinction matters: an online order the customer never paid for *should* expire and give its stock back. Suggested window: 30 minutes from creation, which is long enough for a slow Mobile Money approval.
- [ ] **Never expire pay-on-delivery orders.** A `Pending` order on that method is genuine business waiting for a confirmation call, not an abandoned basket. Any expiry job must filter on `PaymentMethod == Hubtel` — getting this wrong cancels real orders.

### 1.3 Delivery cost

`Order.TotalMinor` is the sum of line items. The checkout form collects an address it never prices.

- [ ] Delivery fee model — flat, per-region, or free over a threshold.
- [ ] Add it to the order total server-side (never from the client).
- [ ] Show it in the cart and checkout summary before the customer commits.

### 1.4 Guest orders are readable by anyone who guesses the reference — FIXED 2026-09-17

`FindByReferenceAsync` allowed an order with no `UserId` to be read by reference alone, and `GET /api/orders/{reference}` is unauthenticated. The reference was `BB-yyyyMMdd-NNNNN` — 100,000 values per day, so a script walked the whole day's orders in seconds and got each customer's email, items and totals.

- [x] Checkout now issues a `bb_orders` grant cookie naming the orders this browser placed (`OrderAccessGrant`), and a guest lookup has to present it. A cookie rather than an email in the query string: it survives a reload and the payment redirect, and keeps the customer's address out of the access logs. No frontend change needed — RTK Query already sends credentials.
- [x] A missing grant returns 404, not 403: confirming a reference exists is half of what an enumeration script wants.
- [x] A stale grant cannot reach an order that belongs to an account — covered by a test.
- [x] `GET /api/orders/{reference}` rate limited.

### 1.5 Order references collide — FIXED 2026-09-17

`Identifier.OrderReference` was the date plus `Random.Shared.Next(0, 100_000)` with no uniqueness check, against a unique index. Two orders drawing the same number on the same day threw at checkout — a lost sale, not a caught error. At ~200 orders a day, roughly a one-in-five chance of happening that day.

- [x] The suffix is now 40 bits from the cryptographic RNG in Crockford base32 (`BB-20260917-K7QX4M9T`): no collisions at any realistic volume, and no longer guessable, which backs up the grant cookie above. The alphabet drops I, L, O and U so nothing is misheard when a customer reads it down the phone.

---

## 2. Blocks running the shop day to day

### 2.1 Admin surface — DONE 2026-09-17

`UserRole.Admin` is seeded by `DatabaseSeeder` and nothing anywhere authorises against it. Today, changing a price or marking an order fulfilled means opening `psql`.

- [x] Authorization policy for the `Admin` role, applied to the whole `/api/admin` group so a route added later is protected by default rather than by remembering to.
- [x] Orders: list with status filter and paging, detail with the delivery details, and the transitions the state machine allows — paid, delivered, cancelled, refunded.
- [x] **Cancelling returns the reserved stock**, which is the manual half of §1.2 and works today. Re-cancelling does not release it twice.
- [x] Products: price, stock and visibility, listed **including inactive ones** — the storefront list hides those, so without it deactivating a product was a one-way door. Stock levels are on a separate admin DTO; the public endpoint still exposes only `inStock`, because exact inventory tells a competitor the shop's sales figures.
- [x] Admin UI at `/admin` — orders queue, order detail, products. Phone numbers are `tel:` links: confirming by phone is the first thing that happens to a new order.

**Why this moved ahead of payments:** the checkout says *"Pay on delivery by Mobile Money or cash. We confirm your order by phone."* The shop can trade now, so orders are real and someone has to work them.

### 2.2 Email — BUILT 2026-09-18, needs SMTP credentials

- [x] **Mail provider.** Plain SMTP over MailKit (`Infrastructure/Email/`), not a provider-specific API — Resend, Brevo, Zoho, Mailgun and SendGrid all speak it, so the provider stays a configuration choice. Config section `Email`, bound in `AddInfrastructure`.
- [x] **Nothing sends on the request thread.** `EmailOutbox` is a bounded in-memory queue drained by `EmailDispatcher`, a `BackgroundService`, with three attempts and a backoff. The order is already committed when the message is queued; a slow provider must not turn a placed order into an error the customer reads as "it did not go through". The queue is bounded so a wedged provider cannot grow it until the process dies — a full queue drops and logs loudly.
- [x] **Contact enquiry → shop inbox**, with `Reply-To` set to the customer so answering is one keystroke. Still logged as well, so there is a record even if mail is misconfigured.
- [x] **Order confirmation**, on placement for both payment methods, worded differently for each.
- [x] **New-order alert to the shop**, a separate message with the phone number and address up front and a link into `/admin`.
- [x] **Payment receipt** when Hubtel settles, sent from inside the transition guard so the callback and the order page both reconciling does not send two.
- [x] **Dispatch notice** when an order is marked Fulfilled. For pay on delivery it carries the amount the rider will collect.
- [x] **Cancellation notice**, careful not to promise a refund is already moving — refunds are still arranged by hand (§1.1).
- [x] **Templates that survive a plain-text client.** Every message has both bodies; the HTML is one table with inline styles, no stylesheet, no web font, no remote image. All interpolation is HTML-escaped — a customer's name and delivery notes are free text that ends up inside markup.
- [x] **A pay-on-delivery order marked Paid sends nothing.** That transition means the rider took the cash at the door; thanking the customer for a payment they just handed over reads as a mistake.
- [ ] **Set the credentials.** Five settings, from whichever provider you pick:

  ```bash
  cd backend
  dotnet user-secrets set "Email:Host" "smtp.provider.com" --project src/BodyBiotics.Api
  dotnet user-secrets set "Email:UserName" "…"            --project src/BodyBiotics.Api
  dotnet user-secrets set "Email:Password" "…"            --project src/BodyBiotics.Api
  dotnet user-secrets set "Email:FromAddress" "orders@bodybioticsgh.com" --project src/BodyBiotics.Api
  dotnet user-secrets set "Email:ShopInbox" "info@bodybioticsgh.com"     --project src/BodyBiotics.Api
  ```

  In production the same values are `Email__Host`, `Email__FromAddress` and so on. **`Email:SiteUrl` must be the real storefront origin** — it builds the links in every message, password reset above all. `Email:Port` defaults to 587 with STARTTLS; 465 is detected and switched to implicit TLS.

- [ ] **Verify the sending domain with the provider** (SPF, DKIM, usually a DMARC record). Skip it and the mail is technically sent and lands in spam, which is worse than not sending — you will believe customers were told.
- [ ] **Send one of each to yourself** before launch: place a test order, mark it Fulfilled, cancel another. Gmail on a phone and one plain-text client.

### 2.3 Password reset — DONE 2026-09-18

- [x] `PasswordResetToken` entity + migration (`20260918033859_PasswordResetTokens`). **Only the SHA-256 of the token is stored**; the plaintext exists once, in the email. A database dump then does not hand over a working reset link for every account that recently asked for one.
- [x] `POST /api/auth/forgot-password` and `POST /api/auth/reset-password`, both on the same rate-limit policy as login — one sends mail to anyone who asks, the other is a guess at a token.
- [x] Single-use, expiring (60 minutes). Asking twice invalidates the first link, so an older mail sitting in an inbox stops working.
- [x] **An unknown email is indistinguishable from a known one** — same status, same body, same path. Expired, spent and never-existed all give one message for the same reason.
- [x] **Every session is revoked on reset**, in the same `SaveChanges` as the password change: the usual reason for a reset is that somebody else has the password.
- [x] The customer is signed straight in afterwards. They have just proved control of the mailbox and chosen a password; a login form at that point is where people give up.
- [x] `LostPasswordForm` posts to the API instead of handing out a WhatsApp link, and `/account/reset-password` is where the emailed link lands — `noindex`, and already inside `robots.txt`'s `/account/` disallow.
- [x] **With no mail provider configured the endpoint refuses rather than accepting silently**, and the form falls back to WhatsApp. Accepting quietly would leave the customer waiting for a mail that cannot arrive.

### 2.4 Review photos are written to container-local disk

`ReviewPhotoStore` saves under `wwwroot/uploads/reviews`. Every redeploy loses them, and with two instances half the photos 404.

- [ ] Move to object storage (S3-compatible) or a mounted volume.
- [ ] Reviews publish instantly with no moderation flag. Decide: pre-moderate, or post-moderate with a takedown path.

---

## 3. Production readiness

- [ ] **Distributed rate limiting.** The limiter is in-memory, so the 10/min auth limit multiplies by instance count. Redis is already in `docker-compose.yml` and the API never touches it.
- [ ] **CI deploy.** `.github/workflows/ci.yml` has `push: false`, no registry credentials, no deploy job, and no migration step. Deploy order that avoids downtime: migrate → roll API → roll frontend.
- [ ] **Production environment and secrets.** Nothing is defined outside local dev. `App__ConnectionString` etc. via environment; never `appsettings.json`. The full set to define: `App__ConnectionString`, `App__SeedAdminPassword` (12+ characters — the API refuses to start otherwise), `App__TrustedProxies__0`, `App__CorsOrigins` (leave empty in production), `API_ORIGIN`, the `Email__*` set from §2.2 including `Email__SiteUrl`, the `Hubtel__*` set from §1.1 including `Hubtel__PublicApiUrl`, and `NEXT_PUBLIC_SITE_URL` set to the real domain **before** the frontend is built, since it is inlined at build time.
- [ ] **Error tracking.** A failed checkout in Accra is currently invisible.
- [ ] **Metrics and a log sink.** Structured logs already exist; nothing collects them.
- [ ] **Image CDN.** ~17MB of catalogue WebP is served off the Next box.
- [x] **Lighthouse budgets in CI** — DONE 2026-09-17. `frontend/lighthouserc.json` plus a `lighthouse` job that runs against Postgres and the real API, because a score measured on an empty catalogue is meaningless. Three runs per URL, asserted on the median: one run on a shared CI box is too noisy to gate on. Gates performance ≥ 0.75, accessibility and SEO ≥ 0.9, LCP ≤ 4s, CLS ≤ 0.1, total transfer ≤ 2.5MB. **The thresholds are a starting point** — Docker was not available here to run the suite against a live API, so tune them from the first real CI run rather than trusting these numbers.
- [x] **Error pages** — DONE 2026-09-17. `not-found.tsx` (routes back into the catalogue rather than apologising — most 404s here will be dead WooCommerce URLs), `error.tsx` (keeps the shell, offers a retry, prints the digest so support has something searchable) and `global-error.tsx` (inline styles only: when the root layout fails, the stylesheet and fonts are gone by definition).

---

## 4. Product and growth

- [x] **SEO** — DONE 2026-09-17.
  - `robots.ts` and `sitemap.ts`. The sitemap is rebuilt hourly rather than pinned at build time, because products come and go without a deploy. It degrades to the static routes when the catalogue cannot be read — the frontend build runs in CI with no API, and a red build is worse than a thin sitemap.
  - Per-page metadata and canonicals for products, categories and brands, fetched server-side through the new `src/lib/api/server.ts`. These pages had **no titles or descriptions at all** before: they render client-side, so there was nothing for a crawler to read.
  - Unknown slugs now answer a real 404 instead of a 200 with an error state in it. The old site's dead product URLs are still being crawled, and a soft 404 keeps them indexed forever.
  - Product JSON-LD (name, images, sku, brand, price, availability). No `aggregateRating` — the endpoint does not summarise reviews yet, and inventing one is what gets structured data penalised. Worth adding when it does.
  - Organization and WebSite JSON-LD site-wide, tying the Instagram and TikTok accounts to the shop.
  - Redirects for the old WooCommerce URLs. The import mirror shows the shapes that existed: `/product/<slug>/`, `/product-category/<slug>/`, `/product-tag/<slug>/`, `/brand/<slug>/`. Only the category archive moved; that one plus the paged archives, `/my-account/*` and the WordPress feed paths now 308 to their new homes.
- [ ] **Analytics.** None of any kind. `start_url: "/?source=pwa"` already tags installed traffic, nothing reads it.
- [x] **Offline order queue (IndexedDB)** — DONE 2026-09-17. A checkout that never reaches the API (`FETCH_ERROR`/`TIMEOUT_ERROR`, not a rejection) is stored in IndexedDB keyed by its `requestId` and replayed on reconnect and on next app open, by a component in the root layout rather than on the checkout page — the customer who loses signal mid-checkout is exactly the one who closes the tab. Replay reuses the original `requestId`, so the API returns the original order instead of creating a second. A 4xx on replay drops the order rather than retrying something that will never succeed, and five failed attempts gives up. Storage failure never blocks checkout; it just means the order is not queued.
- [ ] **Play Store listing**, if wanted: `/.well-known/assetlinks.json`, signing key, Bubblewrap, privacy policy (page exists) and a data-safety declaration.
- [x] **Wishlist** — DONE 2026-09-17. Server-side, keyed by user or the existing anonymous cart cookie, and merged onto the account at sign-in alongside the cart. Deliberately **not** localStorage: iOS evicts a whole origin's storage after about a week of no use, and SETUP.md §6.3 already rules out keeping anything there you would miss. Heart toggle on every product card and the product page, a `/wishlist` page reusing the shop grid, and a header count. Optimistic with rollback — a filled heart on a save that never landed is the one outcome worth avoiding.

---

## 4.5 Security

Read the whole security-critical path on 2026-09-17: auth, sessions, cart ownership, checkout, uploads, rate limiting, headers, proxy.

**What is already right** — worth knowing so nobody "fixes" it:

- Passwords are hashed with ASP.NET Core's `PasswordHasher` (PBKDF2, versioned, rehash-on-login). Never stored or logged in the clear.
- The session cookie is `HttpOnly` + `Secure` outside dev, so JavaScript cannot read it. `SessionValidator` re-checks the session row on every request, so revocation is immediate.
- Unknown emails still burn a hash, so response timing cannot be used to discover which emails have accounts.
- Prices are never taken from the client — `CheckoutService` prices every line from the catalogue. A tampered request cannot buy a serum for 1 pesewa.
- All database access is EF Core with parameters. No string-concatenated SQL anywhere, so no SQL injection.
- No `dangerouslySetInnerHTML` anywhere in the frontend, so review text and product descriptions cannot inject script. Keep it that way.
- Checkout is idempotent by unique index, not by application logic.

**What needs fixing**, worst first:

### 4.5.1 Rate limiting silently stops working in production — FIXED 2026-09-17

`RateLimitPolicies` partitions on `httpContext.Connection.RemoteIpAddress`, and the comment says `UseForwardedHeaders` makes that the real client IP. It does not: `ForwardedHeadersOptions` only trusts loopback by default, so once the API runs in a container behind Next it ignores `X-Forwarded-For` entirely.

Two consequences, both bad:

- Every customer shares one bucket. The limit is 10/min and it covers login, register, checkout and review submission — so a handful of shoppers checking out in the same minute locks out the entire shop. One person with a script can hold it closed all day.
- `CartOwnerAccessor` sets the anonymous cart cookie with `Secure = httpContext.Request.IsHttps`, which is also false for the same reason, so that cookie goes out without `Secure` over the public internet.

- [x] `App:TrustedProxies` now configures the trust list — single addresses or CIDR ranges (`172.16.0.0/12` for a Docker bridge network), with `ForwardLimit = 1`. The trust list is never simply emptied: that would make `X-Forwarded-For` attacker-controlled and turn the login limiter off completely.
- [x] Startup logs a warning when a non-Development environment has not set it, so this cannot fail silently again.
- [x] The cart cookie's `Secure` flag no longer depends on `Request.IsHttps` — it is set from the environment, so it cannot silently go missing behind a proxy.
- [ ] **Still to do at deploy time:** put the real proxy address in `App__TrustedProxies__0`, then check one request's resolved client IP is the customer's and not the proxy's.

### 4.5.2 Only the auth policy is rate limited — FIXED 2026-09-17

There was no global limiter. The catalogue, cart and `GET /api/orders/{reference}` took unlimited requests — which is also what made the order enumeration in §1.4 practical.

- [x] Global per-IP limiter at 600/min. Deliberately generous: Ghanaian mobile networks put many real customers behind one carrier NAT address, so a tight global limit throttles a whole network rather than an attacker. The sensitive endpoints keep the 10/min `Auth` policy.

### 4.5.3 Default admin credentials in `appsettings.json` — FIXED 2026-09-17

`SeedAdminEmail: admin@bodybiotics.test` / `SeedAdminPassword: change-me-locally` are committed defaults. Seeding only runs when `MigrateOnStart` is true, which is dev and CI — but the moment someone enabled it against production, the shop would have an admin account with a password that is in the git history. That becomes a full compromise as soon as §2.1 gives the `Admin` role any power.

- [x] The API now refuses to start if seeding outside Development would use the committed default, and the error says what to set instead. Development is unaffected.

### 4.5.4 Uploads are trusted by content type — PARTLY FIXED 2026-09-17

`ReviewPhotoStore` picked the file extension from the client's `Content-Type` header with no check of the actual bytes.

- [x] The extension now comes from the file's own leading bytes (JPEG, PNG and WebP signatures); the `Content-Type` header is ignored entirely. Anything else is rejected.
- [ ] **EXIF is still not stripped** — customer photos carry GPS coordinates, and a review photo taken at home publishes where the customer lives. Stripping it means re-encoding through an imaging library, so it needs a decision first: ImageSharp is the obvious .NET choice but its licence is paid above a revenue threshold; SkiaSharp and Magick.NET are the free alternatives. Worth doing before reviews are promoted publicly.

### 4.5.5 Missing hardening headers — FIXED 2026-09-17

`next.config.ts` set `nosniff`, `X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy`. Now also:

- [x] **Content-Security-Policy.** Everything is `'self'`. `script-src` and `style-src` keep `'unsafe-inline'` — Next's hydration bootstrap is an inline script and next/font emits inline styles, and the alternative is a per-request nonce from `proxy.ts` that makes every page dynamic and costs the static shell this PWA is built on. That is the weak directive: do not casually add third-party script origins next to it. `frame-ancestors`, `base-uri`, `form-action` and `object-src` cost nothing and are what actually stop clickjacking and form hijacking.
- [x] **Strict-Transport-Security**, one year with `includeSubDomains`. Browsers ignore it over plain HTTP, so it is inert locally and live the moment TLS is. No `preload` — that is a one-way submission to a browser-vendor list that commits subdomains which do not exist yet.
- [x] An e2e test asserts these ship, so a future config edit cannot quietly drop them.
- [ ] `AllowedHosts: "*"` in `appsettings.json` — pin it to the real host at deploy time.

**Watch out when payments land:** the provider will need its own `script-src`, `connect-src` and `frame-src` entries in the CSP, and `upgrade-insecure-requests` must stay out of it — it rewrites the service worker's precache fetches to https, they fail over plain http, the worker never installs and offline support disappears silently. That is not theoretical; it happened while adding this and the PWA e2e caught it.

Plus the two order bugs in §1.4 and §1.5, which are security issues as much as correctness ones.

**Verdict:** nothing here was a break-in waiting to happen — no injection, no XSS, no exposed admin, no plaintext passwords. The two that mattered (4.5.1, an outsider closing the shop; §1.4, customer order data readable by guessing) are fixed. 4.5.2, 4.5.4 and 4.5.5 remain, and none of them is urgent before the site is reachable — do them before taking payments.

---

## 5. Housekeeping

- [x] `docs/SETUP.md` §8 rewritten — it listed cart endpoints and checkout as missing. Fixed 2026-09-17.
- [x] README and SETUP test counts corrected to 104 backend. Fixed 2026-09-17.
- [x] **Fixed 2026-09-17: the checkout threw away the delivery address.** `CheckoutRequest` collected name, phone, address, city and notes, validated all of them, and `Order` stored only the email. Every order placed before this is undeliverable. The fields are on the order now, with a migration, and the storefront order view shows them back to the customer.
- [x] **Fixed 2026-09-18: every order line was called "Product".** `CheckoutService` built each `OrderItem` with a `ProductId` but no `Product` navigation, and both the checkout response DTO and — once §2.2 landed — the confirmation email read the name off that navigation. Customers saw "Product x2" on the order page instead of "Glow Serum x2". Found while writing the email templates.
- [x] **Fixed 2026-09-17: `apiErrorMessage` never saw the API's message.** RTK Query wraps the response as `{ status, data }`, one level deeper than the check looked, so every caller in the app silently fell back to its generic text — "We could not place your order" instead of "Glow Serum does not have 3 left in stock".
- [x] Sign-in now invalidates the wishlist cache, which the API merges onto the account during login.
- [ ] Smoke-test a real iPhone before release. WebKit in Playwright is a regression net, not an iOS device — no home-screen install, different storage eviction.

---

## Suggested order to launch

1. The two deploy-stoppers above — the seed password and the site URL. Minutes, not hours.
2. Somewhere to host it, with the environment set and HTTPS on (§3). This is the real work left.
3. ~~Email (§2.2), so enquiries reach a person and customers get a confirmation.~~ Built — set the SMTP credentials and verify the sending domain.
4. Decide delivery pricing, or agree it is quoted on the confirmation call (§1.3).
5. Smoke-test on a real iPhone, place one live order end to end, and work it through the admin screens.
6. Hubtel: close the cancellation return and expiry gaps in §1.1, then credentials and one live test transaction. The code is in; it is switched off until then.

### Already cleared

~~§1.4, §1.5, §4.5.1, §4.5.3~~, ~~the security section~~, ~~error pages, SEO, wishlist, offline queue, Lighthouse~~ and ~~§2.1 the admin surface~~ — all done 2026-09-17.
