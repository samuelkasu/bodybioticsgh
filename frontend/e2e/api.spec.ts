import { expect, test } from "@playwright/test";

test.describe("API contract", () => {
  test("health check reports database connectivity", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);

    const body = (await response.json()) as { data: { status: string } };
    expect(body.data.status).toBe("ok");
  });

  test("product list is paginated and wrapped in the standard envelope", async ({
    request,
  }) => {
    const response = await request.get("/api/products?page=1&perPage=2");
    expect(response.status()).toBe(200);

    const body = (await response.json()) as {
      data: { items: { slug: string }[]; page: number; perPage: number; total: number };
    };
    expect(body.data.page).toBe(1);
    expect(body.data.perPage).toBe(2);
    expect(body.data.items.length).toBeLessThanOrEqual(2);
    // The imported catalogue, not the three placeholders it replaced.
    expect(body.data.total).toBeGreaterThan(100);
  });

  test("rejects an out-of-range perPage rather than dumping the catalogue", async ({
    request,
  }) => {
    const response = await request.get("/api/products?perPage=5000");
    expect(response.status()).toBe(400);

    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  test("rejects an unknown sort value", async ({ request }) => {
    const response = await request.get("/api/products?sort=cheapest");
    expect(response.status()).toBe(400);
  });

  test("sorts by price ascending", async ({ request }) => {
    const response = await request.get("/api/products?sort=price-asc&perPage=5");
    const body = (await response.json()) as { data: { items: { priceMinor: number }[] } };

    const prices = body.data.items.map((item) => item.priceMinor);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  test("filters by category", async ({ request }) => {
    const categories = await request.get("/api/categories");
    const categoryBody = (await categories.json()) as {
      data: { slug: string; productCount: number }[];
    };
    const first = categoryBody.data[0];
    expect(first).toBeDefined();

    const response = await request.get(
      `/api/products?category=${first?.slug}&perPage=48`,
    );
    const body = (await response.json()) as {
      data: { items: { categorySlug: string }[]; total: number };
    };

    expect(body.data.total).toBe(first?.productCount);
    for (const item of body.data.items) {
      expect(item.categorySlug).toBe(first?.slug);
    }
  });

  test("categories and brands carry product counts", async ({ request }) => {
    for (const path of ["/api/categories", "/api/brands"]) {
      const response = await request.get(path);
      expect(response.status()).toBe(200);

      const body = (await response.json()) as {
        data: { slug: string; name: string; productCount: number }[];
      };
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.data[0]?.productCount).toBeGreaterThan(0);
    }
  });

  test("product detail includes gallery and related items", async ({ request }) => {
    const list = await request.get("/api/products?perPage=1");
    const listBody = (await list.json()) as { data: { items: { slug: string }[] } };
    const slug = listBody.data.items[0]?.slug;

    const response = await request.get(`/api/products/${slug}`);
    expect(response.status()).toBe(200);

    const body = (await response.json()) as {
      data: { product: { slug: string }; images: unknown[]; related: unknown[] };
    };
    expect(body.data.product.slug).toBe(slug);
    expect(Array.isArray(body.data.images)).toBe(true);
    expect(Array.isArray(body.data.related)).toBe(true);
  });

  test("unknown product slug returns a typed 404", async ({ request }) => {
    const response = await request.get("/api/products/does-not-exist");
    expect(response.status()).toBe(404);

    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("NOT_FOUND");
  });

  test("session endpoint answers anonymously and is never shared-cached", async ({
    request,
  }) => {
    const response = await request.get("/api/auth/session");
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("private");

    const body = (await response.json()) as { data: { user: unknown } };
    expect(body.data.user).toBeNull();
  });

  test("cart starts empty and is never shared-cached", async ({ request }) => {
    const response = await request.get("/api/cart");
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("private");

    const body = (await response.json()) as { data: { itemCount: number } };
    expect(body.data.itemCount).toBe(0);
  });

  test("checkout refuses an empty cart", async ({ request }) => {
    const response = await request.post("/api/checkout", {
      data: {
        email: "customer@example.com",
        fullName: "Ama Mensah",
        phone: "0241234567",
        addressLine: "12 Oxford Street",
        city: "Accra",
        requestId: `e2e-${Date.now()}`,
      },
    });

    expect(response.status()).toBe(400);
  });

  test("checkout refuses an area the shop does not deliver to", async ({ request }) => {
    const response = await request.post("/api/checkout", {
      data: {
        email: "customer@example.com",
        fullName: "Ama Mensah",
        phone: "0241234567",
        addressLine: "12 Oxford Street",
        city: "Accra",
        deliveryZone: "lagos",
        requestId: `e2e-${Date.now()}`,
      },
    });

    expect(response.status()).toBe(400);
  });

  test("delivery areas are public and priced", async ({ request }) => {
    const response = await request.get("/api/delivery-options");
    expect(response.status()).toBe(200);

    const body = (await response.json()) as {
      data: {
        zones: { code: string; feeMinor: number }[];
        freeDeliveryThresholdMinor: number;
      };
    };

    expect(body.data.zones.length).toBeGreaterThan(0);
    expect(body.data.freeDeliveryThresholdMinor).toBeGreaterThan(0);
    // The checkout page cannot show a total before the order is placed without
    // this, which is the whole reason it is public.
    expect(body.data.zones.every((zone) => zone.feeMinor >= 0)).toBe(true);
  });

  test("contact form validates before accepting", async ({ request }) => {
    const response = await request.post("/api/contact", {
      data: { name: "", email: "nope", subject: "Inquiry", message: "hi" },
    });

    expect(response.status()).toBe(400);
  });
});

test.describe("cart and checkout", () => {
  test("adds an item, then places an order that is idempotent on retry", async ({
    request,
  }) => {
    const list = await request.get("/api/products?perPage=24");
    const listBody = (await list.json()) as {
      data: { items: { id: string; inStock: boolean; priceMinor: number }[] };
    };
    const product = listBody.data.items.find((item) => item.inStock);
    expect(product, "seed data should contain an in-stock product").toBeDefined();

    const added = await request.post("/api/cart/items", {
      data: { productId: product?.id, quantity: 2 },
    });
    expect(added.status()).toBe(200);

    const cart = (await added.json()) as {
      data: { itemCount: number; subtotalMinor: number };
    };
    expect(cart.data.itemCount).toBe(2);
    // The server prices the line; the client never sends a price.
    expect(cart.data.subtotalMinor).toBe((product?.priceMinor ?? 0) * 2);

    const requestId = `e2e-${Date.now()}`;
    const payload = {
      email: "customer@example.com",
      fullName: "Ama Mensah",
      phone: "0241234567",
      addressLine: "12 Oxford Street",
      city: "Accra",
      deliveryZone: "accra-central",
      requestId,
    };

    const first = await request.post("/api/checkout", { data: payload });
    expect(first.status()).toBe(201);
    const firstBody = (await first.json()) as {
      data: {
        reference: string;
        subtotalMinor: number;
        deliveryFeeMinor: number;
        totalMinor: number;
        status: string;
      };
    };
    expect(firstBody.data.status).toBe("PENDING");

    const goods = (product?.priceMinor ?? 0) * 2;
    expect(firstBody.data.subtotalMinor).toBe(goods);
    // The client sends the area, never the fee — the server prices it, and the
    // total is the sum it computed rather than anything the client proposed.
    expect(firstBody.data.totalMinor).toBe(goods + firstBody.data.deliveryFeeMinor);

    // Same idempotency key: the original order comes back, nothing new is made.
    const retry = await request.post("/api/checkout", { data: payload });
    expect(retry.status()).toBe(200);
    const retryBody = (await retry.json()) as { data: { reference: string } };
    expect(retryBody.data.reference).toBe(firstBody.data.reference);

    const emptied = await request.get("/api/cart");
    const emptiedBody = (await emptied.json()) as { data: { itemCount: number } };
    expect(emptiedBody.data.itemCount).toBe(0);
  });
});
