using BodyBiotics.Domain.Abstractions;
using BodyBiotics.Domain.Entities;
using BodyBiotics.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BodyBiotics.Infrastructure.Repositories;

public sealed class WishlistRepository(AppDbContext db) : IWishlistRepository
{
    public async Task<IReadOnlyList<WishlistItem>> ListAsync(
        CartOwner owner,
        CancellationToken cancellationToken) =>
        await Query(owner)
            .Include(item => item.Product)
            .ThenInclude(product => product!.Category)
            .Include(item => item.Product)
            .ThenInclude(product => product!.Brand)
            .OrderByDescending(item => item.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task<WishlistItem?> FindAsync(
        CartOwner owner,
        string productId,
        CancellationToken cancellationToken) =>
        await Query(owner).FirstOrDefaultAsync(
            item => item.ProductId == productId,
            cancellationToken);

    public void Add(WishlistItem item) => db.WishlistItems.Add(item);

    public void Remove(WishlistItem item) => db.WishlistItems.Remove(item);

    public async Task MergeAsync(
        string anonId,
        string userId,
        CancellationToken cancellationToken)
    {
        var anonymous = await db.WishlistItems
            .Where(item => item.AnonId == anonId)
            .ToListAsync(cancellationToken);

        if (anonymous.Count == 0)
        {
            return;
        }

        var alreadySaved = await db.WishlistItems
            .Where(item => item.UserId == userId)
            .Select(item => item.ProductId)
            .ToListAsync(cancellationToken);

        var owned = alreadySaved.ToHashSet(StringComparer.Ordinal);

        foreach (var item in anonymous)
        {
            // Saved on both the account and the cookie: keep the account's row,
            // which is older, and drop the duplicate. The unique index would
            // reject it anyway.
            if (owned.Contains(item.ProductId))
            {
                db.WishlistItems.Remove(item);
                continue;
            }

            item.UserId = userId;
            item.AnonId = null;
            owned.Add(item.ProductId);
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        db.SaveChangesAsync(cancellationToken);

    private IQueryable<WishlistItem> Query(CartOwner owner) =>
        db.WishlistItems.Where(item => owner.UserId != null
            ? item.UserId == owner.UserId
            : item.AnonId == owner.AnonId);
}
