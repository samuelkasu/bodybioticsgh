using BodyBiotics.Domain.Abstractions;
using BodyBiotics.Domain.Entities;
using BodyBiotics.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BodyBiotics.Infrastructure.Repositories;

public sealed class AdminRepository(AppDbContext db) : IAdminRepository
{
    public async Task<PagedResult<Order>> ListOrdersAsync(
        OrderStatus? status,
        string? search,
        DateTimeOffset? placedFrom,
        DateTimeOffset? placedTo,
        int page,
        int perPage,
        CancellationToken cancellationToken)
    {
        var query = db.Orders.AsQueryable();

        if (status is { } wanted)
        {
            query = query.Where(order => order.Status == wanted);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            // One box over every field staff are given down a phone line: the
            // reference from a confirmation email, a name, a number, a town.
            var term = $"%{search.Trim()}%";
            query = query.Where(order =>
                EF.Functions.ILike(order.Reference, term) ||
                EF.Functions.ILike(order.FullName, term) ||
                EF.Functions.ILike(order.Email, term) ||
                EF.Functions.ILike(order.Phone, term) ||
                EF.Functions.ILike(order.City, term));
        }

        if (placedFrom is { } after)
        {
            query = query.Where(order => order.CreatedAt >= after);
        }

        if (placedTo is { } before)
        {
            query = query.Where(order => order.CreatedAt <= before);
        }

        var total = await query.CountAsync(cancellationToken);

        // Newest first: staff work the queue from the top, and the orders that
        // need ringing are the ones that just arrived.
        var items = await query
            .AsNoTracking()
            .Include(order => order.Items)
            .ThenInclude(item => item.Product)
            .OrderByDescending(order => order.CreatedAt)
            .Skip((page - 1) * perPage)
            .Take(perPage)
            .ToListAsync(cancellationToken);

        return new PagedResult<Order>(items, page, perPage, total);
    }

    // Tracked: the caller transitions the status and saves.
    public async Task<Order?> FindOrderAsync(
        string reference,
        CancellationToken cancellationToken) =>
        await db.Orders
            .Include(order => order.Items)
            .ThenInclude(item => item.Product)
            .FirstOrDefaultAsync(order => order.Reference == reference, cancellationToken);

    public async Task<PagedResult<Product>> ListProductsAsync(
        string? search,
        int page,
        int perPage,
        CancellationToken cancellationToken)
    {
        var query = db.Products.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = $"%{search.Trim()}%";
            query = query.Where(product =>
                EF.Functions.ILike(product.Name, term) ||
                EF.Functions.ILike(product.Slug, term));
        }

        var total = await query.CountAsync(cancellationToken);

        var items = await query
            .AsNoTracking()
            .Include(product => product.Category)
            .Include(product => product.Brand)
            .OrderBy(product => product.Name)
            .Skip((page - 1) * perPage)
            .Take(perPage)
            .ToListAsync(cancellationToken);

        return new PagedResult<Product>(items, page, perPage, total);
    }

    public async Task<Product?> FindProductAsync(
        string productId,
        CancellationToken cancellationToken) =>
        await db.Products.FirstOrDefaultAsync(
            product => product.Id == productId,
            cancellationToken);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        db.SaveChangesAsync(cancellationToken);
}
