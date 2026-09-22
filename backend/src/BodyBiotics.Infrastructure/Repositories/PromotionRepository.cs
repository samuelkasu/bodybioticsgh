using BodyBiotics.Domain.Abstractions;
using BodyBiotics.Domain.Entities;
using BodyBiotics.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BodyBiotics.Infrastructure.Repositories;

public sealed class PromotionRepository(AppDbContext db) : IPromotionRepository
{
    public async Task<IReadOnlyList<Promotion>> ListLiveAsync(
        DateTimeOffset now,
        CancellationToken cancellationToken) =>
        await db.Promotions
            .AsNoTracking()
            .Where(promotion =>
                promotion.Active
                && (promotion.StartsAt == null || promotion.StartsAt <= now)
                && (promotion.EndsAt == null || promotion.EndsAt > now))
            .OrderBy(promotion => promotion.Priority)
            .ThenBy(promotion => promotion.Id)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<Promotion>> ListAllAsync(CancellationToken cancellationToken) =>
        await db.Promotions
            .AsNoTracking()
            .OrderBy(promotion => promotion.Priority)
            .ThenBy(promotion => promotion.Name)
            .ToListAsync(cancellationToken);

    public Task<Promotion?> FindPromotionAsync(string id, CancellationToken cancellationToken) =>
        db.Promotions.FirstOrDefaultAsync(promotion => promotion.Id == id, cancellationToken);

    public void Add(Promotion promotion) => db.Promotions.Add(promotion);

    public void Remove(Promotion promotion) => db.Promotions.Remove(promotion);

    // Normalised by the caller, but matched case-insensitively regardless: a
    // row seeded by hand from psql is not guaranteed to be upper-case.
    /// <summary>
    /// An exact match on the normalised code. Deliberately not ILIKE: a code
    /// may legitimately contain an underscore, which is a LIKE wildcard, and
    /// SUM_20 quietly matching SUMX20 is a discount given away. Codes are
    /// upper-cased by <see cref="Coupon.Normalise"/> on the way in, so an exact
    /// comparison is also the case-insensitive one.
    /// </summary>
    public Task<Coupon?> FindCouponAsync(string code, CancellationToken cancellationToken) =>
        db.Coupons.FirstOrDefaultAsync(coupon => coupon.Code == code, cancellationToken);

    public Task<Coupon?> FindCouponByIdAsync(string id, CancellationToken cancellationToken) =>
        db.Coupons.FirstOrDefaultAsync(coupon => coupon.Id == id, cancellationToken);

    public async Task<PagedResult<Coupon>> ListCouponsAsync(
        string? search,
        int page,
        int perPage,
        CancellationToken cancellationToken)
    {
        var query = db.Coupons.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = $"%{search.Trim()}%";
            query = query.Where(coupon =>
                EF.Functions.ILike(coupon.Code, term) ||
                EF.Functions.ILike(coupon.Description, term));
        }

        var total = await query.CountAsync(cancellationToken);

        var items = await query
            .AsNoTracking()
            .OrderByDescending(coupon => coupon.CreatedAt)
            .Skip((page - 1) * perPage)
            .Take(perPage)
            .ToListAsync(cancellationToken);

        return new PagedResult<Coupon>(items, page, perPage, total);
    }

    public void Add(Coupon coupon) => db.Coupons.Add(coupon);

    public void Remove(Coupon coupon) => db.Coupons.Remove(coupon);

    public void Add(CouponRedemption redemption) => db.CouponRedemptions.Add(redemption);

    public void Remove(CouponRedemption redemption) => db.CouponRedemptions.Remove(redemption);

    public Task<int> CountRedemptionsAsync(
        string couponId,
        string email,
        CancellationToken cancellationToken) =>
        db.CouponRedemptions.CountAsync(
            redemption => redemption.CouponId == couponId && redemption.Email == email,
            cancellationToken);

    public Task<CouponRedemption?> FindRedemptionForOrderAsync(
        string orderId,
        CancellationToken cancellationToken) =>
        db.CouponRedemptions
            .Include(redemption => redemption.Coupon)
            .FirstOrDefaultAsync(redemption => redemption.OrderId == orderId, cancellationToken);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        db.SaveChangesAsync(cancellationToken);
}
