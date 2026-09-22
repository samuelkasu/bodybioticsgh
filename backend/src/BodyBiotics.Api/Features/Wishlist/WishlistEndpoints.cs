using BodyBiotics.Api.Features.Cart;
using BodyBiotics.Api.Http;

namespace BodyBiotics.Api.Features.Wishlist;

public static class WishlistEndpoints
{
    public static RouteGroupBuilder MapWishlistEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/wishlist").WithTags("Wishlist");

        group.MapGet("/", ListAsync).WithName("GetWishlist");
        group.MapPost("/items", SaveAsync).WithName("SaveToWishlist");
        group.MapDelete("/items/{productId}", RemoveAsync).WithName("RemoveFromWishlist");

        return api;
    }

    private static async Task<IResult> ListAsync(
        HttpContext httpContext,
        WishlistService wishlist,
        CartOwnerAccessor owner,
        CancellationToken cancellationToken)
    {
        var result = await wishlist.ListAsync(
            owner.Resolve(createIfMissing: false),
            cancellationToken);

        CacheHeaders.Private(httpContext.Response);
        return ApiResults.Ok(result);
    }

    private static async Task<IResult> SaveAsync(
        SaveToWishlistRequest request,
        HttpContext httpContext,
        WishlistService wishlist,
        CartOwnerAccessor owner,
        CancellationToken cancellationToken)
    {
        // A write, so this is where a guest earns their cookie.
        var result = await wishlist.SaveAsync(
            owner.Resolve(createIfMissing: true),
            request,
            cancellationToken);

        CacheHeaders.Private(httpContext.Response);
        return ApiResults.Ok(result);
    }

    private static async Task<IResult> RemoveAsync(
        string productId,
        HttpContext httpContext,
        WishlistService wishlist,
        CartOwnerAccessor owner,
        CancellationToken cancellationToken)
    {
        var result = await wishlist.RemoveAsync(
            owner.Resolve(createIfMissing: false),
            productId,
            cancellationToken);

        CacheHeaders.Private(httpContext.Response);
        return ApiResults.Ok(result);
    }
}
