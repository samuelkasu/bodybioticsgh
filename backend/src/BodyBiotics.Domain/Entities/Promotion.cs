namespace BodyBiotics.Domain.Entities;

/// <summary>
/// How a discount is worked out. Stored as text like every other enum here, so
/// reordering cannot silently reprice a live campaign.
/// </summary>
public enum DiscountType
{
    /// <summary>A share of the qualifying goods, capped by MaxDiscountMinor when set.</summary>
    Percentage = 0,

    /// <summary>A flat amount off, never more than the qualifying goods are worth.</summary>
    FixedAmount = 1,

    /// <summary>Delivery is waived. Worth nothing off the goods themselves.</summary>
    FreeDelivery = 2,

    /// <summary>
    /// Buy N, get M of the cheapest qualifying units free. Only meaningful on
    /// an automatic <see cref="Promotion"/>; a coupon cannot carry it.
    /// </summary>
    BuyXGetY = 3,
}

/// <summary>
/// Which lines in the basket a discount is allowed to touch. Anything narrower
/// than <see cref="Everything"/> reads <see cref="IPromotionScope.ScopeSlugs"/>.
/// </summary>
public enum PromotionScope
{
    Everything = 0,
    Category = 1,
    Brand = 2,
    Product = 3,
}

/// <summary>
/// The parts a coupon and an automatic promotion share, so the pricing engine
/// can take either without knowing which it has.
/// </summary>
public interface IPromotionScope
{
    DiscountType DiscountType { get; }

    PromotionScope Scope { get; }

    /// <summary>
    /// Comma-separated slugs, matched against the line's category, brand or
    /// product slug depending on <see cref="Scope"/>. Stored as text rather
    /// than as join tables: the same shape <see cref="ProductTag"/> already
    /// uses, and a campaign is edited as a list, never queried by member.
    /// </summary>
    string? ScopeSlugs { get; }

    /// <summary>Percent (1–100) or a flat amount in minor units, by type.</summary>
    int Value { get; }

    /// <summary>Ceiling on a percentage discount. Null for uncapped.</summary>
    int? MaxDiscountMinor { get; }

    /// <summary>Qualifying goods must reach this before the discount applies.</summary>
    int MinSpendMinor { get; }

    /// <summary>Qualifying lines must total this many units. Zero for no minimum.</summary>
    int MinQuantity { get; }

    /// <summary>The N of "buy N get M". Ignored unless the type is BuyXGetY.</summary>
    int BuyQuantity { get; }

    /// <summary>The M of "buy N get M".</summary>
    int GetQuantity { get; }
}

/// <summary>
/// A code the customer types in. Distinct from <see cref="Promotion"/> on
/// purpose: a coupon is opted into, is counted, and can be exhausted, while a
/// promotion applies to everyone who qualifies and never runs out.
/// </summary>
public sealed class Coupon : IPromotionScope
{
    /// <summary>Longest code the checkout box accepts; also the column width.</summary>
    public const int MaxCodeLength = 32;

    public required string Id { get; init; }

    /// <summary>
    /// Stored upper-case and matched upper-case. A customer reading a code off
    /// an Instagram story types it however they like.
    /// </summary>
    public required string Code { get; set; }

    /// <summary>Shown on the cart line and on the receipt: "20% off Cerave".</summary>
    public required string Description { get; set; }

    public DiscountType DiscountType { get; set; } = DiscountType.Percentage;

    public PromotionScope Scope { get; set; } = PromotionScope.Everything;

    public string? ScopeSlugs { get; set; }

    public int Value { get; set; }

    public int? MaxDiscountMinor { get; set; }

    public int MinSpendMinor { get; set; }

    public int MinQuantity { get; set; }

    public int BuyQuantity { get; set; }

    public int GetQuantity { get; set; }

    public DateTimeOffset? StartsAt { get; set; }

    public DateTimeOffset? EndsAt { get; set; }

    /// <summary>Total redemptions allowed across every customer. Null for unlimited.</summary>
    public int? UsageLimit { get; set; }

    /// <summary>
    /// Redemptions allowed per customer, counted by email — the account is
    /// optional at this checkout, so the email is the only identity every order
    /// carries.
    /// </summary>
    public int? UsageLimitPerCustomer { get; set; }

    /// <summary>
    /// Incremented inside the checkout transaction. Denormalised from
    /// <see cref="CouponRedemption"/> so the usual "is there any left" check is
    /// a column read rather than a count over the whole redemption table.
    /// </summary>
    public int TimesUsed { get; set; }

    public bool Active { get; set; } = true;

    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<CouponRedemption> Redemptions { get; init; } = [];

    /// <summary>
    /// Live for anyone, before looking at a particular basket. Stock of
    /// redemptions is part of this: an exhausted coupon is as dead as an
    /// expired one.
    /// </summary>
    public bool IsLive(DateTimeOffset now) =>
        Active
        && (StartsAt is null || StartsAt <= now)
        && (EndsAt is null || EndsAt > now)
        && (UsageLimit is null || TimesUsed < UsageLimit);

    public bool HasExpired(DateTimeOffset now) => EndsAt is not null && EndsAt <= now;

    public bool IsExhausted => UsageLimit is not null && TimesUsed >= UsageLimit;

    public static string Normalise(string code) => code.Trim().ToUpperInvariant();
}

/// <summary>
/// One use of a coupon on one order. Written in the same transaction as the
/// order, so a per-customer limit cannot be walked past by checking out twice
/// at once, and a cancelled order can give its redemption back.
/// </summary>
public sealed class CouponRedemption
{
    public required string Id { get; init; }

    public required string CouponId { get; init; }
    public Coupon? Coupon { get; init; }

    public required string OrderId { get; init; }
    public Order? Order { get; init; }

    /// <summary>Null for a guest checkout, which is most of them.</summary>
    public string? UserId { get; init; }

    /// <summary>Lower-cased, and what the per-customer limit is counted by.</summary>
    public required string Email { get; init; }

    public required int AmountMinor { get; init; }

    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
}

/// <summary>
/// An automatic basket rule — no code, applied to everyone who qualifies. The
/// free-delivery threshold the shop has always run is the archetype.
/// </summary>
public sealed class Promotion : IPromotionScope
{
    public required string Id { get; init; }

    /// <summary>Staff-facing, so a campaign is recognisable in the admin list.</summary>
    public required string Name { get; set; }

    /// <summary>Customer-facing, shown on the discount line in the basket.</summary>
    public required string Description { get; set; }

    public DiscountType DiscountType { get; set; } = DiscountType.Percentage;

    public PromotionScope Scope { get; set; } = PromotionScope.Everything;

    public string? ScopeSlugs { get; set; }

    public int Value { get; set; }

    public int? MaxDiscountMinor { get; set; }

    public int MinSpendMinor { get; set; }

    public int MinQuantity { get; set; }

    public int BuyQuantity { get; set; }

    public int GetQuantity { get; set; }

    public DateTimeOffset? StartsAt { get; set; }

    public DateTimeOffset? EndsAt { get; set; }

    public bool Active { get; set; } = true;

    /// <summary>
    /// Lower runs first. Matters because a non-stacking promotion stops the
    /// ones behind it, and because two percentage rules applied in the other
    /// order give a different answer.
    /// </summary>
    public int Priority { get; set; }

    /// <summary>
    /// False means this promotion is the only one that applies once it does.
    /// The default is true — a shop that wants one campaign at a time says so.
    /// </summary>
    public bool Stackable { get; set; } = true;

    /// <summary>
    /// Copy for the storefront's announcement strip while this is running. Null
    /// for a promotion that works quietly.
    /// </summary>
    public string? BannerText { get; set; }

    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public bool IsLive(DateTimeOffset now) =>
        Active
        && (StartsAt is null || StartsAt <= now)
        && (EndsAt is null || EndsAt > now);
}
