using BodyBiotics.Domain.Common;
using BodyBiotics.Domain.Entities;

namespace BodyBiotics.Tests.Domain;

/// <summary>
/// The arithmetic every discount in the shop comes out of. These are the tests
/// that matter most in this feature: everything else can be re-run, but a
/// basket priced wrong has already been charged.
/// </summary>
public class PricingEngineTests
{
    private static readonly DateTimeOffset Now = new(2026, 6, 1, 12, 0, 0, TimeSpan.Zero);

    private static PricingLine Line(
        string id,
        int unitPriceMinor,
        int quantity,
        string? category = null,
        string? brand = null) =>
        new(id, $"product-{id}", category, brand, unitPriceMinor, quantity);

    private static Promotion Promotion(
        DiscountType type = DiscountType.Percentage,
        int value = 10,
        int minSpendMinor = 0,
        PromotionScope scope = PromotionScope.Everything,
        string? scopeSlugs = null,
        int priority = 0,
        bool stackable = true,
        int buy = 0,
        int get = 0,
        int? maxDiscountMinor = null) => new()
        {
            Id = $"promo-{Guid.NewGuid():N}",
            Name = "Test",
            Description = "Test offer",
            DiscountType = type,
            Value = value,
            MinSpendMinor = minSpendMinor,
            Scope = scope,
            ScopeSlugs = scopeSlugs,
            Priority = priority,
            Stackable = stackable,
            BuyQuantity = buy,
            GetQuantity = get,
            MaxDiscountMinor = maxDiscountMinor,
        };

    private static Coupon Coupon(
        DiscountType type = DiscountType.Percentage,
        int value = 10,
        int minSpendMinor = 0,
        int minQuantity = 0,
        PromotionScope scope = PromotionScope.Everything,
        string? scopeSlugs = null,
        int? maxDiscountMinor = null,
        int? usageLimit = null,
        int timesUsed = 0,
        bool active = true,
        DateTimeOffset? startsAt = null,
        DateTimeOffset? endsAt = null) => new()
        {
            Id = "coupon-1",
            Code = "SAVE10",
            Description = "10% off",
            DiscountType = type,
            Value = value,
            MinSpendMinor = minSpendMinor,
            MinQuantity = minQuantity,
            Scope = scope,
            ScopeSlugs = scopeSlugs,
            MaxDiscountMinor = maxDiscountMinor,
            UsageLimit = usageLimit,
            TimesUsed = timesUsed,
            Active = active,
            StartsAt = startsAt,
            EndsAt = endsAt,
        };

    [Fact]
    public void AnEmptyBasketCostsNothing()
    {
        var result = PricingEngine.Price([], [], null, Now);

        Assert.Equal(0, result.SubtotalMinor);
        Assert.Equal(0, result.DiscountMinor);
        Assert.Empty(result.Discounts);
    }

    [Fact]
    public void WithNoCampaignsTheBasketIsJustItsGoods()
    {
        var result = PricingEngine.Price([Line("a", 12_500, 2)], [], null, Now);

        Assert.Equal(25_000, result.SubtotalMinor);
        Assert.Equal(0, result.DiscountMinor);
        Assert.Equal(25_000, result.DiscountedSubtotalMinor);
    }

    [Fact]
    public void APercentagePromotionTakesItsShare()
    {
        var result = PricingEngine.Price(
            [Line("a", 10_000, 1)],
            [Promotion(value: 20)],
            null,
            Now);

        Assert.Equal(2_000, result.DiscountMinor);
        Assert.Equal(8_000, result.DiscountedSubtotalMinor);
    }

    [Fact]
    public void APercentageRoundsAwayFromZero()
    {
        // 33% of 101 pesewas is 33.33; 50% of 101 is 50.5, which must round to
        // 51 and not to 50. Half-pesewa cases are the ones that drift.
        var result = PricingEngine.Price(
            [Line("a", 101, 1)],
            [Promotion(value: 50)],
            null,
            Now);

        Assert.Equal(51, result.DiscountMinor);
    }

    [Fact]
    public void APercentageIsCappedWhenACeilingIsSet()
    {
        var result = PricingEngine.Price(
            [Line("a", 100_000, 1)],
            [Promotion(value: 50, maxDiscountMinor: 20_000)],
            null,
            Now);

        Assert.Equal(20_000, result.DiscountMinor);
    }

    [Fact]
    public void AFixedDiscountNeverExceedsTheGoods()
    {
        var result = PricingEngine.Price(
            [Line("a", 3_000, 1)],
            [Promotion(DiscountType.FixedAmount, value: 10_000)],
            null,
            Now);

        Assert.Equal(3_000, result.DiscountMinor);
        // Never negative: a basket cannot be worth less than nothing.
        Assert.Equal(0, result.DiscountedSubtotalMinor);
    }

    [Fact]
    public void APromotionBelowItsMinimumSpendDoesNotApply()
    {
        var result = PricingEngine.Price(
            [Line("a", 5_000, 1)],
            [Promotion(value: 20, minSpendMinor: 10_000)],
            null,
            Now);

        Assert.Equal(0, result.DiscountMinor);
        Assert.Empty(result.Discounts);
    }

    [Fact]
    public void AScopedPromotionTouchesOnlyItsOwnLines()
    {
        var result = PricingEngine.Price(
            [
                Line("a", 10_000, 1, brand: "cerave"),
                Line("b", 10_000, 1, brand: "nivea"),
            ],
            [Promotion(value: 50, scope: PromotionScope.Brand, scopeSlugs: "cerave")],
            null,
            Now);

        Assert.Equal(5_000, result.DiscountMinor);
        Assert.Equal(5_000, result.LineDiscountMinor["a"]);
        Assert.Equal(0, result.LineDiscountMinor["b"]);
    }

    [Fact]
    public void AScopedPromotionWithNoScopeListAppliesToNothing()
    {
        // A misconfigured campaign must not become a store-wide sale.
        var result = PricingEngine.Price(
            [Line("a", 10_000, 1, brand: "cerave")],
            [Promotion(value: 50, scope: PromotionScope.Brand, scopeSlugs: null)],
            null,
            Now);

        Assert.Equal(0, result.DiscountMinor);
    }

    [Fact]
    public void ScopeMatchingIgnoresCase()
    {
        var result = PricingEngine.Price(
            [Line("a", 10_000, 1, brand: "cerave")],
            [Promotion(value: 50, scope: PromotionScope.Brand, scopeSlugs: "CeraVe, nivea")],
            null,
            Now);

        Assert.Equal(5_000, result.DiscountMinor);
    }

    [Fact]
    public void FreeDeliveryIsWorthNothingOffTheGoods()
    {
        var result = PricingEngine.Price(
            [Line("a", 10_000, 1)],
            [Promotion(DiscountType.FreeDelivery)],
            null,
            Now);

        Assert.Equal(0, result.DiscountMinor);
        Assert.True(result.FreeDeliveryGranted);
        Assert.Single(result.Discounts);
    }

    [Fact]
    public void BuyTwoGetOneGivesAwayTheCheapestUnit()
    {
        // Three units: a GH₵200 serum and two GH₵20 soaps. The free one is a
        // soap, not the serum.
        var result = PricingEngine.Price(
            [Line("a", 20_000, 1), Line("b", 2_000, 2)],
            [Promotion(DiscountType.BuyXGetY, buy: 2, get: 1)],
            null,
            Now);

        Assert.Equal(2_000, result.DiscountMinor);
    }

    [Fact]
    public void BuyTwoGetOneNeedsAWholeGroup()
    {
        var result = PricingEngine.Price(
            [Line("a", 2_000, 2)],
            [Promotion(DiscountType.BuyXGetY, buy: 2, get: 1)],
            null,
            Now);

        Assert.Equal(0, result.DiscountMinor);
    }

    [Fact]
    public void TwoPromotionsStackAndTheSecondSeesWhatTheFirstLeft()
    {
        // 20% of 10,000 is 2,000. The second rule then takes 50% of the 8,000
        // still on the line, not 50% of the original.
        var result = PricingEngine.Price(
            [Line("a", 10_000, 1)],
            [
                Promotion(value: 20, priority: 0),
                Promotion(value: 50, priority: 1),
            ],
            null,
            Now);

        Assert.Equal(2_000 + 4_000, result.DiscountMinor);
        Assert.Equal(4_000, result.DiscountedSubtotalMinor);
    }

    [Fact]
    public void ANonStackingPromotionStopsTheOnesBehindIt()
    {
        var result = PricingEngine.Price(
            [Line("a", 10_000, 1)],
            [
                Promotion(value: 20, priority: 0, stackable: false),
                Promotion(value: 50, priority: 1),
            ],
            null,
            Now);

        Assert.Equal(2_000, result.DiscountMinor);
        Assert.Single(result.Discounts);
    }

    [Fact]
    public void ANonStackingPromotionAlsoBlocksACoupon()
    {
        var result = PricingEngine.Price(
            [Line("a", 10_000, 1)],
            [Promotion(value: 20, stackable: false)],
            Coupon(value: 50),
            Now);

        Assert.Equal(2_000, result.DiscountMinor);
        Assert.Equal(CouponRejection.BlockedByPromotion, result.CouponRejection);
    }

    [Fact]
    public void ACouponStacksOnTopOfAnOrdinaryPromotion()
    {
        var result = PricingEngine.Price(
            [Line("a", 10_000, 1)],
            [Promotion(value: 20)],
            Coupon(value: 50),
            Now);

        Assert.Equal(2_000 + 4_000, result.DiscountMinor);
        Assert.Equal(2, result.Discounts.Count);
        Assert.Equal(CouponRejection.None, result.CouponRejection);
    }

    [Theory]
    [InlineData(false, true, CouponRejection.Inactive)]
    [InlineData(true, false, CouponRejection.Exhausted)]
    public void ADeadCouponIsRefusedWithAReason(
        bool active,
        bool hasUsesLeft,
        CouponRejection expected)
    {
        var coupon = Coupon(
            active: active,
            usageLimit: hasUsesLeft ? null : 5,
            timesUsed: hasUsesLeft ? 0 : 5);

        var result = PricingEngine.Price([Line("a", 10_000, 1)], [], coupon, Now);

        Assert.Equal(expected, result.CouponRejection);
        Assert.Equal(0, result.DiscountMinor);
    }

    [Fact]
    public void AnExpiredCouponIsRefused()
    {
        var result = PricingEngine.Price(
            [Line("a", 10_000, 1)],
            [],
            Coupon(endsAt: Now.AddDays(-1)),
            Now);

        Assert.Equal(CouponRejection.Expired, result.CouponRejection);
    }

    [Fact]
    public void ACouponThatHasNotStartedIsRefused()
    {
        var result = PricingEngine.Price(
            [Line("a", 10_000, 1)],
            [],
            Coupon(startsAt: Now.AddDays(1)),
            Now);

        Assert.Equal(CouponRejection.NotStarted, result.CouponRejection);
    }

    [Fact]
    public void ACouponAlreadyUsedByThisCustomerIsRefused()
    {
        var result = PricingEngine.Price(
            [Line("a", 10_000, 1)],
            [],
            Coupon(),
            Now,
            couponAlreadyUsedByCustomer: true);

        Assert.Equal(CouponRejection.AlreadyUsed, result.CouponRejection);
    }

    [Fact]
    public void ACouponBelowItsMinimumSpendSaysSo()
    {
        var result = PricingEngine.Price(
            [Line("a", 5_000, 1)],
            [],
            Coupon(minSpendMinor: 10_000),
            Now);

        Assert.Equal(CouponRejection.MinSpend, result.CouponRejection);
    }

    [Fact]
    public void ACouponThatMatchesNothingInTheBasketSaysSo()
    {
        var result = PricingEngine.Price(
            [Line("a", 10_000, 1, brand: "nivea")],
            [],
            Coupon(scope: PromotionScope.Brand, scopeSlugs: "cerave"),
            Now);

        Assert.Equal(CouponRejection.NoMatchingItems, result.CouponRejection);
    }

    [Fact]
    public void LineDiscountsAlwaysSumToTheBasketDiscount()
    {
        // Three lines and a percentage that does not divide evenly: the
        // apportionment must not lose or invent a pesewa.
        var lines = new[]
        {
            Line("a", 3_333, 1),
            Line("b", 3_333, 1),
            Line("c", 3_334, 1),
        };

        var result = PricingEngine.Price(lines, [Promotion(value: 33)], null, Now);

        Assert.Equal(result.DiscountMinor, result.LineDiscountMinor.Values.Sum());
    }

    [Fact]
    public void ALineNeverGivesBackMoreThanItIsWorth()
    {
        var lines = new[] { Line("a", 1_000, 1), Line("b", 50_000, 1) };

        var result = PricingEngine.Price(
            lines,
            [Promotion(DiscountType.FixedAmount, value: 51_000)],
            null,
            Now);

        Assert.Equal(51_000, result.DiscountMinor);
        Assert.True(result.LineDiscountMinor["a"] <= 1_000);
        Assert.True(result.LineDiscountMinor["b"] <= 50_000);
        Assert.Equal(result.DiscountMinor, result.LineDiscountMinor.Values.Sum());
    }
}
