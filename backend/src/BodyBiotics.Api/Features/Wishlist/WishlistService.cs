using BodyBiotics.Api.Features.Products;
using BodyBiotics.Api.Http;
using BodyBiotics.Domain.Abstractions;
using BodyBiotics.Domain.Common;
using BodyBiotics.Domain.Entities;
using FluentValidation;

namespace BodyBiotics.Api.Features.Wishlist;

/// <summary>
/// Saved products for a visitor, identified the same way the cart is: by user
/// when signed in, by the anonymous cookie otherwise.
/// </summary>
public sealed class WishlistService(
    IWishlistRepository wishlist,
    IProductRepository products,
    IValidator<SaveToWishlistRequest> validator)
{
    public async Task<WishlistDto> ListAsync(
        CartOwner owner,
        CancellationToken cancellationToken)
    {
        if (!HasIdentity(owner))
        {
            return Empty;
        }

        var items = await wishlist.ListAsync(owner, cancellationToken);
        return ToDto(items);
    }

    /// <summary>
    /// Idempotent: saving something already saved answers with the unchanged
    /// list rather than failing. A double tap on a slow connection is the
    /// normal case, not an error.
    /// </summary>
    public async Task<WishlistDto> SaveAsync(
        CartOwner owner,
        SaveToWishlistRequest request,
        CancellationToken cancellationToken)
    {
        await validator.ValidateAndThrowAsync(request, cancellationToken);

        if (!HasIdentity(owner))
        {
            throw new ApiException(ApiErrorCode.BadRequest, "No wishlist to save to");
        }

        var existing = await wishlist.FindAsync(owner, request.ProductId, cancellationToken);

        if (existing is null)
        {
            // Checked rather than assumed: the id comes from the client, and a
            // row pointing at a product that no longer exists would break the
            // wishlist page for good.
            var found = await products.FindByIdsAsync([request.ProductId], cancellationToken);
            if (found.Count == 0)
            {
                throw new ApiException(ApiErrorCode.NotFound, "That product no longer exists");
            }

            wishlist.Add(new WishlistItem
            {
                Id = Identifier.New(),
                UserId = owner.UserId,
                AnonId = owner.AnonId,
                ProductId = request.ProductId,
            });

            await wishlist.SaveChangesAsync(cancellationToken);
        }

        return ToDto(await wishlist.ListAsync(owner, cancellationToken));
    }

    /// <summary>Removing something that is not saved is equally not an error.</summary>
    public async Task<WishlistDto> RemoveAsync(
        CartOwner owner,
        string productId,
        CancellationToken cancellationToken)
    {
        if (!HasIdentity(owner))
        {
            return Empty;
        }

        var existing = await wishlist.FindAsync(owner, productId, cancellationToken);

        if (existing is not null)
        {
            wishlist.Remove(existing);
            await wishlist.SaveChangesAsync(cancellationToken);
        }

        return ToDto(await wishlist.ListAsync(owner, cancellationToken));
    }

    public Task MergeAsync(string anonId, string userId, CancellationToken cancellationToken) =>
        wishlist.MergeAsync(anonId, userId, cancellationToken);

    /// <summary>
    /// A visitor who has never written anything has no cookie yet, and reads
    /// must not mint one — that would hand a wishlist to every crawler.
    /// </summary>
    private static bool HasIdentity(CartOwner owner) =>
        !string.IsNullOrEmpty(owner.UserId) || !string.IsNullOrEmpty(owner.AnonId);

    private static readonly WishlistDto Empty = new([], 0);

    private static WishlistDto ToDto(IReadOnlyList<WishlistItem> items)
    {
        var products = items
            .Where(item => item.Product is not null)
            .Select(item => ProductDto.From(item.Product!))
            .ToList();

        return new WishlistDto(products, products.Count);
    }
}
