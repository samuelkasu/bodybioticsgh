using BodyBiotics.Domain.Entities;

namespace BodyBiotics.Domain.Abstractions;

/// <summary>
/// Reads and writes campaigns. The storefront only ever calls the read side;
/// the write side is reachable through the admin policy alone.
/// </summary>
public interface IPromotionRepository
{
    /// <summary>
    /// Every automatic rule that is live right now, ordered by priority. Read
    /// on each cart and each checkout, so it is deliberately small — a shop
    /// runs a handful of campaigns, not thousands.
    /// </summary>
    Task<IReadOnlyList<Promotion>> ListLiveAsync(
        DateTimeOffset now,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<Promotion>> ListAllAsync(CancellationToken cancellationToken);

    Task<Promotion?> FindPromotionAsync(string id, CancellationToken cancellationToken);

    void Add(Promotion promotion);

    void Remove(Promotion promotion);

    /// <summary>By code, case-insensitively. Tracked: checkout increments its counter.</summary>
    Task<Coupon?> FindCouponAsync(string code, CancellationToken cancellationToken);

    Task<Coupon?> FindCouponByIdAsync(string id, CancellationToken cancellationToken);

    Task<PagedResult<Coupon>> ListCouponsAsync(
        string? search,
        int page,
        int perPage,
        CancellationToken cancellationToken);

    void Add(Coupon coupon);

    void Remove(Coupon coupon);

    void Add(CouponRedemption redemption);

    void Remove(CouponRedemption redemption);

    /// <summary>
    /// How many times this email has already used this coupon. Counted rather
    /// than cached: the per-customer limit is usually one, and getting it wrong
    /// means giving a discount away repeatedly.
    /// </summary>
    Task<int> CountRedemptionsAsync(
        string couponId,
        string email,
        CancellationToken cancellationToken);

    /// <summary>Gives a cancelled order's redemption back to the coupon.</summary>
    Task<CouponRedemption?> FindRedemptionForOrderAsync(
        string orderId,
        CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
