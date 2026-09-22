using BodyBiotics.Domain.Abstractions;
using BodyBiotics.Domain.Common;
using BodyBiotics.Domain.Entities;

namespace BodyBiotics.Api.Features.Promotions;

/// <summary>
/// A priced basket and the coupon behind it, when there was one. The coupon
/// comes back tracked so checkout can increment its counter without loading it
/// a second time.
/// </summary>
public sealed record PricedCart(CartPricing Pricing, Coupon? Coupon)
{
    /// <summary>
    /// True when a code was applied but did not survive re-pricing — the
    /// campaign ended, the basket changed, the last use went to someone else.
    /// The caller drops it and tells the customer why.
    /// </summary>
    public bool CouponRejected => Pricing.CouponRejection != CouponRejection.None;
}

/// <summary>
/// What a product card shows: the price to pay, the price to strike through,
/// and the saving to badge. The last three are null when nothing is on offer.
/// </summary>
public sealed record ProductDisplayPrice(
    int PriceMinor,
    int? CompareAtPriceMinor,
    int? DiscountPercent,
    /// <summary>When this price stops being true, if it is time-limited.</summary>
    DateTimeOffset? EndsAt);

/// <summary>
/// Prices a basket against whatever campaigns are running. Used by the cart
/// (so the customer sees the figure) and by checkout (which charges it), so
/// there is exactly one answer and the two cannot drift.
/// </summary>
public sealed class PricingService(IPromotionRepository promotions)
{
    /// <summary>
    /// A basket line as the engine wants it. The unit price is the product's
    /// effective price, so a running product sale is already in the number
    /// before any basket campaign looks at it.
    /// </summary>
    public static PricingLine ToLine(Product product, int quantity, DateTimeOffset now) =>
        new(
            product.Id,
            product.Slug,
            product.Category?.Slug,
            product.Brand?.Slug,
            product.EffectivePriceMinor(now),
            quantity);

    /// <summary>
    /// What a single unit of a product costs on a catalogue card once the
    /// running campaigns are taken into account, and what to strike through.
    ///
    /// Only percentage promotions are projected onto a card. A flat "GH₵20
    /// off the basket" applies once to a whole order, so showing it against
    /// every product would advertise a price the till will not honour; the
    /// same goes for buy-X-get-Y and free delivery, which are not a unit price
    /// at all. Those still apply at checkout — they are simply not something a
    /// single card can promise.
    ///
    /// Thresholds take care of themselves: the basket priced here is one unit,
    /// so a promotion needing GH₵200 or three items only shows on a card that
    /// genuinely reaches it by itself.
    /// </summary>
    public static ProductDisplayPrice DisplayPrice(
        Product product,
        IReadOnlyList<Promotion> promotions,
        DateTimeOffset now)
    {
        var listPrice = product.PriceMinor;
        var afterSale = product.EffectivePriceMinor(now);

        var applicable = promotions
            .Where(promotion => promotion.DiscountType == DiscountType.Percentage)
            .ToList();

        var charged = afterSale;
        DateTimeOffset? promotionEndsAt = null;

        if (applicable.Count > 0)
        {
            // The real engine on a one-unit basket, rather than a second
            // implementation of the same arithmetic here. Priority order,
            // "cannot be combined", scope matching and rounding then come out
            // identical to what checkout charges, because it is the same code.
            var priced = PricingEngine.Price(
                [ToLine(product, 1, now)],
                applicable,
                coupon: null,
                now);

            charged = priced.DiscountedSubtotalMinor;

            // The soonest end date among the campaigns that actually applied:
            // that is when this price stops being true.
            promotionEndsAt = applicable
                .Where(promotion => priced.Discounts.Any(
                    discount => discount.Reference == promotion.Id))
                .Select(promotion => promotion.EndsAt)
                .Where(endsAt => endsAt is not null)
                .Min();
        }

        if (charged >= listPrice || listPrice <= 0)
        {
            return new ProductDisplayPrice(charged, null, null, null);
        }

        // Rounded down, so a 19.6% cut advertises as 19% off. A badge claiming
        // more than the till takes off is the one customers complain about.
        var percent = (int)((listPrice - charged) * 100L / listPrice);

        // The product's own sale end and the campaign's, whichever comes first.
        var saleEndsAt = product.IsOnSale(now) ? product.SaleEndsAt : null;
        var endsAt = saleEndsAt is null || promotionEndsAt is null
            ? saleEndsAt ?? promotionEndsAt
            : new[] { saleEndsAt.Value, promotionEndsAt.Value }.Min();

        return new ProductDisplayPrice(charged, listPrice, percent, endsAt);
    }

    public async Task<PricedCart> PriceAsync(
        IReadOnlyList<PricingLine> lines,
        string? couponCode,
        string? email,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var live = await promotions.ListLiveAsync(now, cancellationToken);

        Coupon? coupon = null;
        var alreadyUsed = false;

        if (!string.IsNullOrWhiteSpace(couponCode))
        {
            coupon = await promotions.FindCouponAsync(
                Coupon.Normalise(couponCode),
                cancellationToken);

            if (coupon is null)
            {
                // No such code: say so rather than pricing as if none was
                // applied, or the customer watches their discount vanish with
                // no explanation.
                return new PricedCart(
                    PricingEngine.Price(lines, live, null, now) with
                    {
                        CouponRejection = CouponRejection.NotFound,
                    },
                    null);
            }

            // Only checkable once there is an email to check against, which is
            // at checkout. Before that the code is allowed to sit in the cart;
            // the order is what the limit actually guards.
            if (coupon.UsageLimitPerCustomer is { } perCustomer && email is not null)
            {
                var used = await promotions.CountRedemptionsAsync(
                    coupon.Id,
                    email.Trim().ToLowerInvariant(),
                    cancellationToken);

                alreadyUsed = used >= perCustomer;
            }
        }

        var pricing = PricingEngine.Price(lines, live, coupon, now, alreadyUsed);

        return new PricedCart(pricing, pricing.CouponRejection == CouponRejection.None ? coupon : null);
    }

    /// <summary>
    /// Records that a coupon was used on an order, inside the caller's
    /// transaction. The counter and the redemption row move together: the
    /// counter is what the "any left?" check reads, the row is what the
    /// per-customer limit counts, and one without the other is a coupon that
    /// can be used twice.
    /// </summary>
    public void Redeem(Coupon coupon, Order order, string? userId, int amountMinor)
    {
        coupon.TimesUsed++;
        coupon.UpdatedAt = DateTimeOffset.UtcNow;

        promotions.Add(new CouponRedemption
        {
            Id = Identifier.New(),
            CouponId = coupon.Id,
            OrderId = order.Id,
            UserId = userId,
            Email = order.Email,
            AmountMinor = amountMinor,
        });
    }

    /// <summary>
    /// Gives a cancelled order's redemption back. Without this a customer whose
    /// order the shop cancels has spent a single-use code on nothing, and a
    /// limited campaign burns down to zero on orders that never shipped.
    /// </summary>
    public async Task ReleaseRedemptionAsync(Order order, CancellationToken cancellationToken)
    {
        var redemption = await promotions.FindRedemptionForOrderAsync(order.Id, cancellationToken);
        if (redemption?.Coupon is not { } coupon)
        {
            return;
        }

        // Floored: a counter that has already been corrected by hand must not
        // be driven negative by a late cancellation.
        coupon.TimesUsed = Math.Max(0, coupon.TimesUsed - 1);
        coupon.UpdatedAt = DateTimeOffset.UtcNow;

        promotions.Remove(redemption);
    }

    /// <summary>
    /// What to tell the customer. The domain deals in reasons, not sentences —
    /// this is the only place a refusal is worded, so the cart and the checkout
    /// cannot say two different things about the same code.
    /// </summary>
    public static string Explain(CouponRejection rejection, Coupon? coupon) => rejection switch
    {
        CouponRejection.NotFound => "That code is not one of ours. Check the spelling and try again.",
        CouponRejection.Inactive => "That code is no longer active.",
        CouponRejection.NotStarted => coupon?.StartsAt is { } starts
            ? $"That offer starts on {starts:d MMMM}."
            : "That offer has not started yet.",
        CouponRejection.Expired => "That code has expired.",
        CouponRejection.Exhausted => "That code has been fully claimed.",
        CouponRejection.AlreadyUsed => "You have already used that code.",
        CouponRejection.MinSpend => coupon is not null
            ? $"That code needs a basket of {Money.Format(coupon.MinSpendMinor)} or more in qualifying items."
            : "Your basket does not reach the minimum for that code.",
        CouponRejection.MinQuantity => coupon is not null
            ? $"That code needs at least {coupon.MinQuantity} qualifying items."
            : "Your basket does not have enough qualifying items for that code.",
        CouponRejection.NoMatchingItems => "That code does not apply to anything in your basket.",
        CouponRejection.BlockedByPromotion => "An offer already running on your basket cannot be combined with a code.",
        _ => "That code could not be applied.",
    };
}
