using BodyBiotics.Api.Features.Products;
using FluentValidation;

namespace BodyBiotics.Api.Features.Wishlist;

/// <summary>
/// Saved products in full, not just their ids: the wishlist page renders the
/// same card as the shop grid, and a second round-trip per item to fetch the
/// details would be indefensible on mobile data.
/// </summary>
public sealed record WishlistDto(IReadOnlyList<ProductDto> Items, int Count);

public sealed record SaveToWishlistRequest(string ProductId);

public sealed class SaveToWishlistRequestValidator : AbstractValidator<SaveToWishlistRequest>
{
    public SaveToWishlistRequestValidator()
    {
        RuleFor(request => request.ProductId).NotEmpty().MaximumLength(32);
    }
}
