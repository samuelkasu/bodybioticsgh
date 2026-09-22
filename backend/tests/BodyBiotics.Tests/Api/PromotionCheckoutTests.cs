using BodyBiotics.Api.Features.Cart;
using BodyBiotics.Api.Features.Checkout;
using BodyBiotics.Api.Features.Promotions;
using BodyBiotics.Api.Http;
using BodyBiotics.Domain.Abstractions;
using BodyBiotics.Domain.Entities;
using BodyBiotics.Tests.Fakes;

namespace BodyBiotics.Tests.Api;

using CartEntity = BodyBiotics.Domain.Entities.Cart;

/// <summary>
/// Sales and codes as they reach a real basket and a real order. The engine's
/// own arithmetic is covered in <see cref="Domain.PricingEngineTests"/>; this
/// is about the wiring around it — that checkout charges the discounted figure,
/// counts the redemption once, and refuses rather than quietly overcharging.
/// </summary>
public class PromotionCheckoutTests
{
    private const string AnonId = "anon-1";

    private static readonly CartOwner Owner = CartOwner.ForAnonymous(AnonId);

    private static readonly CheckoutRequest ValidRequest = new(
        "Customer@Example.com",
        "Ama Mensah",
        "0241234567",
        "12 Oxford Street",
        "Accra",
        null,
        "req-1",
        "accra-central");

    private static Product Product(
        string id = "a",
        int priceMinor = 10_000,
        int stock = 10,
        int? salePriceMinor = null,
        DateTimeOffset? saleStartsAt = null,
        DateTimeOffset? saleEndsAt = null) => new()
        {
            Id = id,
            Slug = $"product-{id}",
            Name = $"Product {id}",
            Description = "Test product",
            PriceMinor = priceMinor,
            SalePriceMinor = salePriceMinor,
            SaleStartsAt = saleStartsAt,
            SaleEndsAt = saleEndsAt,
            ImageUrl = "/catalog/test/main.webp",
            Stock = stock,
        };

    private static Coupon Coupon(
        string code = "SAVE10",
        DiscountType type = DiscountType.Percentage,
        int value = 10,
        int? usageLimit = null,
        int? perCustomer = null,
        DateTimeOffset? endsAt = null) => new()
        {
            Id = "coupon-1",
            Code = code,
            Description = $"{value}% off",
            DiscountType = type,
            Value = value,
            UsageLimit = usageLimit,
            UsageLimitPerCustomer = perCustomer,
            EndsAt = endsAt,
        };

    private sealed record Harness(
        CartService Cart,
        CheckoutService Checkout,
        FakePromotionRepository Promotions,
        FakeCartRepository Carts,
        FakeProductRepository Products);

    private static Harness Build(
        FakePromotionRepository promotions,
        params (Product Product, int Quantity)[] lines)
    {
        var products = new FakeProductRepository([.. lines.Select(line => line.Product)]);
        var carts = new FakeCartRepository();
        var orders = new FakeOrderRepository();
        var pricing = new PricingService(promotions);

        var cart = new CartEntity { Id = "cart-1", AnonId = AnonId };
        foreach (var (product, quantity) in lines)
        {
            cart.Items.Add(new CartItem
            {
                Id = Guid.NewGuid().ToString("N"),
                CartId = cart.Id,
                ProductId = product.Id,
                Product = product,
                Quantity = quantity,
            });
        }

        carts.Carts.Add(cart);

        return new Harness(
            new CartService(
                carts,
                products,
                pricing,
                new AddToCartRequestValidator(),
                new UpdateCartLineRequestValidator(),
                new ApplyCouponRequestValidator()),
            new CheckoutService(
                carts,
                products,
                orders,
                new FakeUnitOfWork(),
                new FakePaymentGateway(),
                new TestMail().Notifier,
                pricing,
                new CheckoutRequestValidator()),
            promotions,
            carts,
            products);
    }

    private static Promotion Promotion(
        DiscountType type = DiscountType.Percentage,
        int value = 25,
        int minSpendMinor = 0,
        PromotionScope scope = PromotionScope.Everything,
        string? scopeSlugs = null,
        DateTimeOffset? endsAt = null) => new()
        {
            Id = $"promo-{Guid.NewGuid():N}",
            Name = "New Year Sale",
            Description = $"{value}% off",
            DiscountType = type,
            Value = value,
            MinSpendMinor = minSpendMinor,
            Scope = scope,
            ScopeSlugs = scopeSlugs,
            EndsAt = endsAt,
        };

    [Fact]
    public void AStoreWidePercentagePromotionPricesTheCard()
    {
        // The case the shop actually ran: 25% off everything, no code.
        var product = Product(priceMinor: 10_000);

        var display = PricingService.DisplayPrice(
            product,
            [Promotion(value: 25)],
            DateTimeOffset.UtcNow);

        Assert.Equal(7_500, display.PriceMinor);
        Assert.Equal(10_000, display.CompareAtPriceMinor);
        Assert.Equal(25, display.DiscountPercent);
    }

    [Fact]
    public void APromotionCompoundsWithAProductsOwnSale()
    {
        // Marked down to 8,000, then 25% off on top. The card strikes through
        // the original shelf price and badges the whole saving.
        var product = Product(priceMinor: 10_000, salePriceMinor: 8_000);

        var display = PricingService.DisplayPrice(
            product,
            [Promotion(value: 25)],
            DateTimeOffset.UtcNow);

        Assert.Equal(6_000, display.PriceMinor);
        Assert.Equal(10_000, display.CompareAtPriceMinor);
        Assert.Equal(40, display.DiscountPercent);
    }

    [Fact]
    public void AFlatAmountOffTheBasketIsNotAdvertisedOnACard()
    {
        // "GH₵20 off your order" applies once to a whole basket. Showing it
        // against every card would promise a price the till will not honour.
        var display = PricingService.DisplayPrice(
            Product(priceMinor: 10_000),
            [Promotion(DiscountType.FixedAmount, value: 2_000)],
            DateTimeOffset.UtcNow);

        Assert.Equal(10_000, display.PriceMinor);
        Assert.Null(display.CompareAtPriceMinor);
    }

    [Fact]
    public void APromotionWithAMinimumSpendIsNotAdvertisedOnACardBelowIt()
    {
        var display = PricingService.DisplayPrice(
            Product(priceMinor: 10_000),
            [Promotion(value: 25, minSpendMinor: 50_000)],
            DateTimeOffset.UtcNow);

        Assert.Equal(10_000, display.PriceMinor);
        Assert.Null(display.DiscountPercent);
    }

    [Fact]
    public void AScopedPromotionOnlyPricesTheCardsItCovers()
    {
        var covered = Product("a", priceMinor: 10_000);
        covered.Brand = new Brand { Id = "b1", Slug = "cerave", Name = "CeraVe" };

        var other = Product("b", priceMinor: 10_000);
        other.Brand = new Brand { Id = "b2", Slug = "nivea", Name = "Nivea" };

        var promotion = Promotion(
            value: 25,
            scope: PromotionScope.Brand,
            scopeSlugs: "cerave");

        var now = DateTimeOffset.UtcNow;

        Assert.Equal(7_500, PricingService.DisplayPrice(covered, [promotion], now).PriceMinor);
        Assert.Equal(10_000, PricingService.DisplayPrice(other, [promotion], now).PriceMinor);
    }

    [Fact]
    public async Task TheCardPriceIsWhatCheckoutCharges()
    {
        // The whole point of pricing the card through the same engine: the
        // figure advertised and the figure collected cannot drift.
        var promotions = new FakePromotionRepository();
        promotions.Promotions.Add(Promotion(value: 25));

        var product = Product(priceMinor: 10_000);
        var harness = Build(promotions, (product, 2));

        var display = PricingService.DisplayPrice(
            product,
            promotions.Promotions,
            DateTimeOffset.UtcNow);

        var (order, _) = await harness.Checkout.PlaceOrderAsync(
            Owner, null, ValidRequest, default);

        // Two units at the advertised price, plus Accra Central delivery.
        Assert.Equal(display.PriceMinor * 2, order.SubtotalMinor - order.DiscountMinor);
        Assert.Equal((display.PriceMinor * 2) + 2_000, order.TotalMinor);
    }

    [Fact]
    public async Task ARunningSaleIsWhatTheCartShows()
    {
        var harness = Build(
            new FakePromotionRepository(),
            (Product(priceMinor: 10_000, salePriceMinor: 7_500), 2));

        var cart = await harness.Cart.GetAsync(Owner, default);

        var line = Assert.Single(cart.Lines);
        Assert.Equal(7_500, line.UnitPriceMinor);
        Assert.Equal(10_000, line.CompareAtPriceMinor);
        Assert.Equal(15_000, cart.SubtotalMinor);
    }

    [Fact]
    public async Task ASaleThatHasNotStartedIsNotApplied()
    {
        var harness = Build(
            new FakePromotionRepository(),
            (Product(
                priceMinor: 10_000,
                salePriceMinor: 7_500,
                saleStartsAt: DateTimeOffset.UtcNow.AddDays(1)), 1));

        var cart = await harness.Cart.GetAsync(Owner, default);

        var line = Assert.Single(cart.Lines);
        Assert.Equal(10_000, line.UnitPriceMinor);
        Assert.Null(line.CompareAtPriceMinor);
    }

    [Fact]
    public async Task AnOrderIsChargedTheSalePriceAndKeepsTheOldOne()
    {
        var harness = Build(
            new FakePromotionRepository(),
            (Product(priceMinor: 10_000, salePriceMinor: 7_500), 1));

        var (order, _) = await harness.Checkout.PlaceOrderAsync(
            Owner, null, ValidRequest, default);

        var line = Assert.Single(order.Lines);
        Assert.Equal(7_500, line.UnitPriceMinor);
        Assert.Equal(10_000, line.ListPriceMinor);
        Assert.Equal(7_500, order.SubtotalMinor);
    }

    [Fact]
    public async Task ApplyingACodeDiscountsTheBasket()
    {
        var harness = Build(new FakePromotionRepository(Coupon(value: 10)), (Product(), 1));

        var cart = await harness.Cart.ApplyCouponAsync(
            Owner,
            new ApplyCouponRequest("save10"),
            default);

        Assert.Equal("SAVE10", cart.CouponCode);
        Assert.Equal(1_000, cart.DiscountMinor);
        Assert.Equal(9_000, cart.DiscountedSubtotalMinor);
        Assert.Single(cart.Discounts);
    }

    [Fact]
    public async Task AnUnknownCodeIsRefusedRatherThanStored()
    {
        var harness = Build(new FakePromotionRepository(), (Product(), 1));

        var error = await Assert.ThrowsAsync<ApiException>(() =>
            harness.Cart.ApplyCouponAsync(Owner, new ApplyCouponRequest("NOPE"), default));

        Assert.Equal(ApiErrorCode.Conflict, error.Code);
        Assert.Null(harness.Carts.Carts[0].CouponCode);
    }

    [Fact]
    public async Task ACodeThatExpiresBeforeCheckoutIsDroppedFromTheCart()
    {
        var coupon = Coupon();
        var harness = Build(new FakePromotionRepository(coupon), (Product(), 1));

        await harness.Cart.ApplyCouponAsync(Owner, new ApplyCouponRequest("SAVE10"), default);

        // The campaign ends while the basket sits there.
        coupon.EndsAt = DateTimeOffset.UtcNow.AddSeconds(-1);

        var cart = await harness.Cart.GetAsync(Owner, default);

        Assert.Null(cart.CouponCode);
        Assert.Equal(0, cart.DiscountMinor);
        Assert.NotNull(cart.CouponMessage);
        // Dropped on the server too, so checkout is not asked to honour it.
        Assert.Null(harness.Carts.Carts[0].CouponCode);
    }

    [Fact]
    public async Task CheckoutChargesTheDiscountedTotalAndCountsTheRedemption()
    {
        var coupon = Coupon(value: 10);
        var promotions = new FakePromotionRepository(coupon);
        var harness = Build(promotions, (Product(priceMinor: 10_000), 1));

        await harness.Cart.ApplyCouponAsync(Owner, new ApplyCouponRequest("SAVE10"), default);

        var (order, created) = await harness.Checkout.PlaceOrderAsync(
            Owner, null, ValidRequest, default);

        Assert.True(created);
        Assert.Equal(10_000, order.SubtotalMinor);
        Assert.Equal(1_000, order.DiscountMinor);
        Assert.Equal("SAVE10", order.CouponCode);
        // Goods 10,000 less 1,000, plus 2,000 delivery for Accra Central.
        Assert.Equal(11_000, order.TotalMinor);

        Assert.Equal(1, coupon.TimesUsed);
        var redemption = Assert.Single(promotions.Redemptions);
        Assert.Equal("customer@example.com", redemption.Email);
        Assert.Equal(1_000, redemption.AmountMinor);
    }

    [Fact]
    public async Task TheCodeIsSpentOnTheOrderAndDoesNotFollowTheNextBasket()
    {
        var harness = Build(new FakePromotionRepository(Coupon()), (Product(), 1));

        await harness.Cart.ApplyCouponAsync(Owner, new ApplyCouponRequest("SAVE10"), default);
        await harness.Checkout.PlaceOrderAsync(Owner, null, ValidRequest, default);

        Assert.Null(harness.Carts.Carts[0].CouponCode);
    }

    [Fact]
    public async Task CheckoutRefusesRatherThanChargingFullPriceForAnExpiredCode()
    {
        var coupon = Coupon();
        var harness = Build(new FakePromotionRepository(coupon), (Product(), 1));

        await harness.Cart.ApplyCouponAsync(Owner, new ApplyCouponRequest("SAVE10"), default);

        // Expires between the basket being priced and the order being placed.
        coupon.EndsAt = DateTimeOffset.UtcNow.AddSeconds(-1);

        var error = await Assert.ThrowsAsync<ApiException>(() =>
            harness.Checkout.PlaceOrderAsync(Owner, null, ValidRequest, default));

        Assert.Equal(ApiErrorCode.Conflict, error.Code);
    }

    [Fact]
    public async Task ReplayingACheckoutDoesNotBurnASecondRedemption()
    {
        var coupon = Coupon(usageLimit: 1);
        var promotions = new FakePromotionRepository(coupon);
        var harness = Build(promotions, (Product(), 1));

        await harness.Cart.ApplyCouponAsync(Owner, new ApplyCouponRequest("SAVE10"), default);

        var (first, created) = await harness.Checkout.PlaceOrderAsync(
            Owner, null, ValidRequest, default);
        var (second, createdAgain) = await harness.Checkout.PlaceOrderAsync(
            Owner, null, ValidRequest, default);

        Assert.True(created);
        Assert.False(createdAgain);
        Assert.Equal(first.Reference, second.Reference);
        Assert.Equal(1, coupon.TimesUsed);
        Assert.Single(promotions.Redemptions);
    }

    [Fact]
    public async Task AFreeDeliveryCodeWaivesTheFeeWithoutTouchingTheGoods()
    {
        var harness = Build(
            new FakePromotionRepository(Coupon("FREESHIP", DiscountType.FreeDelivery, value: 0)),
            (Product(priceMinor: 10_000), 1));

        await harness.Cart.ApplyCouponAsync(Owner, new ApplyCouponRequest("FREESHIP"), default);

        var (order, _) = await harness.Checkout.PlaceOrderAsync(
            Owner, null, ValidRequest, default);

        Assert.Equal(0, order.DiscountMinor);
        Assert.Equal(0, order.DeliveryFeeMinor);
        Assert.Equal(10_000, order.TotalMinor);
    }

    [Fact]
    public async Task ADiscountCanCostTheBasketItsFreeDelivery()
    {
        // Exactly on the GH₵2,000 threshold before the code, under it after.
        // Delivery is priced on what the customer actually pays for goods, so
        // the fee comes back — deliberately, and this is the test that says so.
        var harness = Build(
            new FakePromotionRepository(Coupon(value: 10)),
            (Product(priceMinor: 200_000, stock: 5), 1));

        var before = await harness.Cart.GetAsync(Owner, default);
        Assert.Equal(200_000, before.DiscountedSubtotalMinor);

        await harness.Cart.ApplyCouponAsync(Owner, new ApplyCouponRequest("SAVE10"), default);

        var (order, _) = await harness.Checkout.PlaceOrderAsync(
            Owner, null, ValidRequest, default);

        Assert.Equal(20_000, order.DiscountMinor);
        Assert.Equal(2_000, order.DeliveryFeeMinor);
        Assert.Equal(180_000 + 2_000, order.TotalMinor);
    }

    [Fact]
    public async Task ClearingTheBasketDropsTheCode()
    {
        var harness = Build(new FakePromotionRepository(Coupon()), (Product(), 1));

        await harness.Cart.ApplyCouponAsync(Owner, new ApplyCouponRequest("SAVE10"), default);
        await harness.Cart.ClearAsync(Owner, default);

        Assert.Null(harness.Carts.Carts[0].CouponCode);
    }

    [Fact]
    public async Task ACodeCannotBeAppliedToAnEmptyBasket()
    {
        var harness = Build(new FakePromotionRepository(Coupon()));

        await Assert.ThrowsAsync<ApiException>(() =>
            harness.Cart.ApplyCouponAsync(Owner, new ApplyCouponRequest("SAVE10"), default));
    }

    [Fact]
    public async Task LineDiscountsOnAnOrderSumToItsDiscount()
    {
        var harness = Build(
            new FakePromotionRepository(Coupon(value: 33)),
            (Product("a", 3_333), 1),
            (Product("b", 3_333), 1),
            (Product("c", 3_334), 1));

        await harness.Cart.ApplyCouponAsync(Owner, new ApplyCouponRequest("SAVE10"), default);

        var (order, _) = await harness.Checkout.PlaceOrderAsync(
            Owner, null, ValidRequest, default);

        Assert.Equal(order.DiscountMinor, order.Lines.Sum(line => line.DiscountMinor));
    }
}
