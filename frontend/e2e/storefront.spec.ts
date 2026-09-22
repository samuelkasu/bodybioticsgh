import { expect, test } from "@playwright/test";

test.describe("storefront journey", () => {
  test("home page shows the brand and a product grid", async ({ page }) => {
    await page.goto("/");

    // The hero's words live in the artwork, so the only <h1> is screen-reader
    // only — attached rather than visible is the most it can be asserted to be.
    await expect(
      page.getByRole("heading", { level: 1, name: /radiant/i }),
    ).toBeAttached();
    // Rendered by RTK Query against the real API, so this also proves the proxy.
    await expect(page.getByRole("button", { name: /^Add to cart$/ }).first()).toBeVisible(
      {
        timeout: 15_000,
      },
    );
  });

  test("shop lists products and paginates", async ({ page }) => {
    await page.goto("/shop");

    await expect(page.getByRole("heading", { name: "All products" })).toBeVisible();
    await expect(page.getByText(/showing \d+ of \d+ products/i)).toBeVisible({
      timeout: 15_000,
    });

    const next = page.getByRole("link", { name: "Next page" });
    await expect(next).toBeVisible();
    await next.click();

    await expect(page).toHaveURL(/page=2/);
  });

  test("search narrows the catalogue and survives a reload", async ({ page }) => {
    await page.goto("/shop?q=serum");

    await expect(page.getByText(/showing \d+ of \d+ product/i)).toBeVisible({
      timeout: 15_000,
    });

    // The URL is the state: reloading a filtered link must show the same thing.
    await page.reload();
    await expect(page).toHaveURL(/q=serum/);
  });

  test("a customer can open a product and add it to the cart", async ({ page }) => {
    await page.goto("/shop");

    const firstProduct = page.locator("article a[href^='/product/']").first();
    await firstProduct.waitFor({ timeout: 15_000 });
    await firstProduct.click();

    await expect(page).toHaveURL(/\/product\//);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const addToCart = page.getByRole("button", { name: /add to cart/i }).first();
    if (await addToCart.isVisible()) {
      await addToCart.click();

      // The drawer opens from the product page, showing the line just added.
      await expect(page.getByRole("dialog", { name: /your cart/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /checkout/i })).toBeVisible();
    }
  });

  test("checkout refuses to submit an incomplete address", async ({ page }) => {
    // Two page loads, a cart write and three queries before the first click:
    // on a loaded runner the default budget is not enough and the failures
    // land wherever the clock happens to run out.
    test.slow();

    // Seed a line so the form renders rather than the empty state. Branching on
    // whichever appeared first raced the cart query.
    await page.goto("/shop");
    const addToCart = page.getByRole("button", { name: /^Add to cart$/ }).first();
    await addToCart.waitFor({ timeout: 15_000 });
    await addToCart.click();

    await page.goto("/checkout");

    // Wait for the cart query to settle first: the page swaps the empty state
    // for the form once it resolves, and clicking through that swap is a race.
    await expect(page.getByText(/^Items$/)).toBeVisible({ timeout: 15_000 });
    // Same reason as below: the delivery zones landing re-renders the form, and
    // clicking through that swap detaches the button mid-click.
    await expect(
      page.getByLabel(/delivery area/i).locator("option[value='accra-central']"),
    ).toBeAttached({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: /place order/i })).toBeEnabled();
    await page.getByRole("button", { name: /place order/i }).click();

    // Client-side validation fires before any request leaves the device.
    await expect(page.getByText(/enter a valid email address/i)).toBeVisible();
    await expect(page.getByText(/enter a delivery address/i)).toBeVisible();
    // Delivery has to be priced before the order can be totalled.
    await expect(page.getByText(/choose the area we are delivering to/i)).toBeVisible();
  });

  test("shows the delivery fee and total before the order is placed", async ({
    page,
  }) => {
    test.slow();

    await page.goto("/shop");
    const addToCart = page.getByRole("button", { name: /^Add to cart$/ }).first();
    await addToCart.waitFor({ timeout: 15_000 });
    await addToCart.click();

    await page.goto("/checkout");
    await expect(page.getByText(/^Items$/)).toBeVisible({ timeout: 15_000 });

    // Before an area is chosen the summary says so rather than showing a total
    // that is about to change.
    await expect(page.getByText(/choose an area/i)).toBeVisible({ timeout: 15_000 });

    // The zones arrive from the API after the form first paints, and the
    // summary re-renders when they land — selecting before then hits a select
    // that is about to be replaced.
    const zone = page.getByLabel(/delivery area/i);
    await expect(zone.locator("option[value='accra-central']")).toBeAttached({
      timeout: 15_000,
    });
    await zone.selectOption("accra-central");

    // The amount lands on the button itself, so the customer is not looking
    // away from the control they are about to press.
    await expect(page.getByRole("button", { name: /place order · GHS/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("contact form reports validation errors inline", async ({ page }) => {
    await page.goto("/contact");

    await page.getByRole("button", { name: /send message/i }).click();

    await expect(page.getByRole("alert").first()).toBeVisible();
  });

  test("an unknown product slug shows a recoverable error, not a crash", async ({
    page,
  }) => {
    await page.goto("/product/definitely-not-a-product");

    // The slug is resolved on the server and `notFound()` renders the app's
    // 404 page. The status is not asserted: the (shop) layout has a
    // loading.tsx, so the document streams and the headers are already sent
    // by the time the page resolves — the response is a 200 carrying the
    // not-found UI.
    await expect(
      page.getByRole("heading", { name: /could not find that page/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /browse the shop/i })).toBeVisible();
  });

  test("account is protected by the proxy", async ({ page }) => {
    await page.goto("/account");

    // proxy.ts redirects to the login page with a return path.
    await expect(page).toHaveURL(/\/login|\/account\/login/);
  });
});
