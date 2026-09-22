using BodyBiotics.Domain.Entities;

namespace BodyBiotics.Domain.Common;

/// <summary>
/// One basket line, as the pricing engine needs it: an already-effective unit
/// price (a running product sale has been applied before this point) and enough
/// of the product's taxonomy to decide whether a scoped campaign touches it.
/// </summary>
public sealed record PricingLine(
    string ProductId,
    string ProductSlug,
    string? CategorySlug,
    string? BrandSlug,
    int UnitPriceMinor,
    int Quantity)
{
    public int LineTotalMinor => UnitPriceMinor * Quantity;
}

/// <summary>Where a discount on the basket came from, for the receipt.</summary>
public enum DiscountSource
{
    /// <summary>An automatic rule. Nobody asked for it; they qualified.</summary>
    Promotion = 0,

    /// <summary>A code the customer entered.</summary>
    Coupon = 1,
}

public sealed record AppliedDiscount(
    DiscountSource Source,
    /// <summary>The coupon code, or the promotion's id.</summary>
    string Reference,
    /// <summary>Customer-facing wording: "20% off Cerave".</summary>
    string Label,
    int AmountMinor,
    bool GrantsFreeDelivery);

/// <summary>
/// Why a coupon was turned down. The reason is an enum rather than a string so
/// the wording lives at the edge, in one place, and the domain stays free of
/// customer-facing copy.
/// </summary>
public enum CouponRejection
{
    None = 0,
    NotFound = 1,
    Inactive = 2,
    NotStarted = 3,
    Expired = 4,
    Exhausted = 5,
    AlreadyUsed = 6,
    MinSpend = 7,
    MinQuantity = 8,
    NoMatchingItems = 9,
    BlockedByPromotion = 10,
}

/// <summary>
/// What a basket costs once every campaign has had its say. Line discounts are
/// carried alongside the total because an order has to store them per line: a
/// partial refund of a discounted basket is otherwise guesswork.
/// </summary>
public sealed record CartPricing(
    /// <summary>Goods at their effective prices, before any basket discount.</summary>
    int SubtotalMinor,
    int DiscountMinor,
    /// <summary>What the goods come to after discount. Never below zero.</summary>
    int DiscountedSubtotalMinor,
    bool FreeDeliveryGranted,
    IReadOnlyList<AppliedDiscount> Discounts,
    /// <summary>Product id to the discount apportioned to that line.</summary>
    IReadOnlyDictionary<string, int> LineDiscountMinor,
    CouponRejection CouponRejection)
{
    public static CartPricing Empty { get; } = new(
        0, 0, 0, false, [], new Dictionary<string, int>(), CouponRejection.None);
}

/// <summary>
/// The one place a basket is priced.
///
/// It lives in the domain, beside <see cref="DeliveryZones"/> and for the same
/// reason: the client is shown what a discount comes to so it can display a
/// total, and is never believed about it. The checkout re-runs this inside its
/// transaction and charges that answer.
///
/// Everything is integer minor units throughout. A percentage is the only place
/// rounding happens, it rounds away from zero once, and the result is then
/// apportioned across lines by largest remainder so the line discounts sum to
/// the basket discount exactly.
/// </summary>
public static class PricingEngine
{
    public static CartPricing Price(
        IReadOnlyList<PricingLine> lines,
        IReadOnlyList<Promotion> promotions,
        Coupon? coupon,
        DateTimeOffset now,
        bool couponAlreadyUsedByCustomer = false)
    {
        if (lines.Count == 0)
        {
            return CartPricing.Empty with
            {
                CouponRejection = coupon is null
                    ? CouponRejection.None
                    : CouponRejection.NoMatchingItems,
            };
        }

        var subtotal = lines.Sum(line => line.LineTotalMinor);

        // How much of each line is still available to discount. A second
        // campaign cannot take a share of money the first one already removed.
        var remaining = lines.ToDictionary(
            line => line.ProductId,
            line => line.LineTotalMinor);

        var lineDiscount = lines.ToDictionary(line => line.ProductId, _ => 0);

        var applied = new List<AppliedDiscount>();
        var freeDelivery = false;
        var blocked = false;

        // Priority first, then id: two rules with the same priority must still
        // apply in a stable order, or the same basket prices differently on a
        // retry.
        var ordered = promotions
            .Where(promotion => promotion.IsLive(now))
            .OrderBy(promotion => promotion.Priority)
            .ThenBy(promotion => promotion.Id, StringComparer.Ordinal);

        foreach (var promotion in ordered)
        {
            if (blocked)
            {
                break;
            }

            var outcome = Apply(promotion, lines, remaining, lineDiscount);
            if (outcome is null)
            {
                continue;
            }

            var (amount, grantsFreeDelivery) = outcome.Value;

            // A free-delivery rule is worth nothing off the goods, so it is
            // still "applied" at zero. Anything else at zero is not.
            if (amount == 0 && !grantsFreeDelivery)
            {
                continue;
            }

            freeDelivery |= grantsFreeDelivery;
            applied.Add(new AppliedDiscount(
                DiscountSource.Promotion,
                promotion.Id,
                promotion.Description,
                amount,
                grantsFreeDelivery));

            if (!promotion.Stackable)
            {
                // Stops the promotions behind it and the coupon both: "this
                // offer cannot be combined with any other" is what staff mean
                // when they untick the box.
                blocked = true;
            }
        }

        var rejection = CouponRejection.None;

        if (coupon is not null)
        {
            rejection = Validate(coupon, lines, now, blocked, couponAlreadyUsedByCustomer);

            if (rejection == CouponRejection.None)
            {
                var outcome = Apply(coupon, lines, remaining, lineDiscount);

                if (outcome is null)
                {
                    rejection = CouponRejection.NoMatchingItems;
                }
                else
                {
                    var (amount, grantsFreeDelivery) = outcome.Value;

                    if (amount == 0 && !grantsFreeDelivery)
                    {
                        rejection = CouponRejection.NoMatchingItems;
                    }
                    else
                    {
                        freeDelivery |= grantsFreeDelivery;
                        applied.Add(new AppliedDiscount(
                            DiscountSource.Coupon,
                            coupon.Code,
                            coupon.Description,
                            amount,
                            grantsFreeDelivery));
                    }
                }
            }
        }

        var discount = applied.Sum(entry => entry.AmountMinor);

        return new CartPricing(
            subtotal,
            discount,
            Math.Max(0, subtotal - discount),
            freeDelivery,
            applied,
            lineDiscount,
            rejection);
    }

    /// <summary>
    /// Everything about a coupon that can be judged without working out what it
    /// would be worth. Split out so the storefront can say "spend GH₵50 more"
    /// rather than the flat "that code does not apply".
    /// </summary>
    public static CouponRejection Validate(
        Coupon coupon,
        IReadOnlyList<PricingLine> lines,
        DateTimeOffset now,
        bool blockedByPromotion = false,
        bool alreadyUsedByCustomer = false)
    {
        if (!coupon.Active)
        {
            return CouponRejection.Inactive;
        }

        if (coupon.StartsAt is { } starts && starts > now)
        {
            return CouponRejection.NotStarted;
        }

        if (coupon.HasExpired(now))
        {
            return CouponRejection.Expired;
        }

        if (coupon.IsExhausted)
        {
            return CouponRejection.Exhausted;
        }

        if (alreadyUsedByCustomer)
        {
            return CouponRejection.AlreadyUsed;
        }

        if (blockedByPromotion)
        {
            return CouponRejection.BlockedByPromotion;
        }

        var matching = Matching(coupon, lines);
        if (matching.Count == 0)
        {
            return CouponRejection.NoMatchingItems;
        }

        if (matching.Sum(line => line.LineTotalMinor) < coupon.MinSpendMinor)
        {
            return CouponRejection.MinSpend;
        }

        if (matching.Sum(line => line.Quantity) < coupon.MinQuantity)
        {
            return CouponRejection.MinQuantity;
        }

        return CouponRejection.None;
    }

    /// <summary>
    /// Works out what one rule is worth and writes its share into
    /// <paramref name="lineDiscount"/>. Returns null when the rule does not
    /// qualify at all.
    /// </summary>
    private static (int AmountMinor, bool FreeDelivery)? Apply(
        IPromotionScope rule,
        IReadOnlyList<PricingLine> lines,
        Dictionary<string, int> remaining,
        Dictionary<string, int> lineDiscount)
    {
        var matching = Matching(rule, lines);
        if (matching.Count == 0)
        {
            return null;
        }

        // The thresholds are tested against what the matching goods are worth
        // at their shelf price, not against what is left after another campaign
        // took its share. "Spend GH₵200" has to mean the same thing whatever
        // else is running, or a customer who qualifies alone stops qualifying
        // the moment a second offer starts.
        if (matching.Sum(line => line.LineTotalMinor) < rule.MinSpendMinor)
        {
            return null;
        }

        if (matching.Sum(line => line.Quantity) < rule.MinQuantity)
        {
            return null;
        }

        // What can still be taken off these lines.
        var eligible = matching.Sum(line => remaining[line.ProductId]);

        if (rule.DiscountType == DiscountType.FreeDelivery)
        {
            return (0, true);
        }

        if (eligible <= 0)
        {
            return null;
        }

        var amount = rule.DiscountType switch
        {
            DiscountType.Percentage => Percentage(eligible, rule),
            DiscountType.FixedAmount => Math.Min(Math.Max(0, rule.Value), eligible),
            DiscountType.BuyXGetY => BuyXGetY(matching, remaining, rule),
            _ => 0,
        };

        amount = Math.Min(amount, eligible);

        if (amount <= 0)
        {
            return (0, false);
        }

        Apportion(matching, remaining, lineDiscount, amount);

        return (amount, false);
    }

    private static int Percentage(int eligible, IPromotionScope rule)
    {
        var percent = Math.Clamp(rule.Value, 0, 100);

        // The one rounding decision in the engine, made once, away from zero —
        // the same rule Money.FromMajor uses, so a discount and a price never
        // round in opposite directions.
        var amount = (int)Math.Round(eligible * percent / 100m, MidpointRounding.AwayFromZero);

        return rule.MaxDiscountMinor is { } cap && cap >= 0
            ? Math.Min(amount, cap)
            : amount;
    }

    /// <summary>
    /// The cheapest qualifying units, given away. Cheapest rather than dearest
    /// because "buy two get one free" is an offer on the third item, and a
    /// customer who mixes a GH₵200 serum with a GH₵20 soap does not get the
    /// serum for nothing.
    /// </summary>
    private static int BuyXGetY(
        IReadOnlyList<PricingLine> matching,
        Dictionary<string, int> remaining,
        IPromotionScope rule)
    {
        var buy = Math.Max(1, rule.BuyQuantity);
        var get = Math.Max(1, rule.GetQuantity);
        var group = buy + get;

        var quantity = matching.Sum(line => line.Quantity);
        var free = quantity / group * get;

        if (free <= 0)
        {
            return 0;
        }

        // One entry per unit, cheapest first. Baskets here are a handful of
        // lines with quantities in single digits; the cap on a cart line keeps
        // this bounded at 99 units per line.
        var units = matching
            .SelectMany(line => Enumerable.Repeat(line.UnitPriceMinor, line.Quantity))
            .OrderBy(price => price)
            .Take(free);

        var amount = units.Sum();
        var eligible = matching.Sum(line => remaining[line.ProductId]);

        return Math.Min(amount, eligible);
    }

    /// <summary>
    /// Splits a basket-level discount across the lines it came from, in
    /// proportion to what is left on each, by largest remainder. The shares sum
    /// to the discount exactly — a receipt whose lines do not add up to its
    /// total is a refund dispute waiting to happen.
    /// </summary>
    private static void Apportion(
        IReadOnlyList<PricingLine> matching,
        Dictionary<string, int> remaining,
        Dictionary<string, int> lineDiscount,
        int amount)
    {
        var weights = matching
            .Select(line => (line.ProductId, Weight: remaining[line.ProductId]))
            .Where(entry => entry.Weight > 0)
            .ToList();

        var total = weights.Sum(entry => entry.Weight);
        if (total <= 0)
        {
            return;
        }

        var shares = new Dictionary<string, int>(weights.Count);
        var allocated = 0;

        foreach (var (productId, weight) in weights)
        {
            var share = (int)((long)amount * weight / total);
            shares[productId] = share;
            allocated += share;
        }

        // The floor above always leaves a few pesewas over. They go to the
        // lines with the largest dropped fraction, dearest line first on a tie,
        // and the product id last so the split is deterministic.
        var order = weights
            .OrderByDescending(entry => (long)amount * entry.Weight % total)
            .ThenByDescending(entry => entry.Weight)
            .ThenBy(entry => entry.ProductId, StringComparer.Ordinal)
            .ToList();

        var index = 0;
        while (allocated < amount && order.Count > 0)
        {
            var productId = order[index % order.Count].ProductId;

            // Never more than the line still has on it.
            if (shares[productId] < remaining[productId])
            {
                shares[productId]++;
                allocated++;
            }
            else if (order.All(entry => shares[entry.ProductId] >= remaining[entry.ProductId]))
            {
                break;
            }

            index++;
        }

        foreach (var (productId, share) in shares)
        {
            lineDiscount[productId] += share;
            remaining[productId] -= share;
        }
    }

    /// <summary>The lines a rule is allowed to touch.</summary>
    private static List<PricingLine> Matching(
        IPromotionScope rule,
        IReadOnlyList<PricingLine> lines)
    {
        if (rule.Scope == PromotionScope.Everything)
        {
            return [.. lines];
        }

        var slugs = Slugs(rule.ScopeSlugs);
        if (slugs.Count == 0)
        {
            // Scoped to a category and given no categories: it applies to
            // nothing. Falling back to everything would turn a misconfigured
            // campaign into a store-wide sale.
            return [];
        }

        return
        [
            .. lines.Where(line => rule.Scope switch
            {
                PromotionScope.Category => line.CategorySlug is not null
                    && slugs.Contains(line.CategorySlug),
                PromotionScope.Brand => line.BrandSlug is not null
                    && slugs.Contains(line.BrandSlug),
                PromotionScope.Product => slugs.Contains(line.ProductSlug),
                _ => false,
            }),
        ];
    }

    // Case-insensitive: staff paste a scope list by hand, and "CeraVe" is the
    // same brand as "cerave".
    private static HashSet<string> Slugs(string? value) =>
        string.IsNullOrWhiteSpace(value)
            ? new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            : new HashSet<string>(
                value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
                StringComparer.OrdinalIgnoreCase);
}
