using BodyBiotics.Api.Http;

namespace BodyBiotics.Api.Features.Cart;

public static class CartEndpoints
{
    public static RouteGroupBuilder MapCartEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/cart").WithTags("Cart");

        group.MapGet("/", GetAsync).WithName("GetCart");
        group.MapPost("/items", AddAsync).WithName("AddToCart");
        group.MapPatch("/items", UpdateAsync).WithName("UpdateCartLine");
        group.MapDelete("/", ClearAsync).WithName("ClearCart");

        // Throttled like the credential endpoints: an unlimited "is this a
        // code?" oracle is how a valid code gets found by guessing.
        group.MapPost("/coupon", ApplyCouponAsync)
            .WithName("ApplyCoupon")
            .RequireRateLimiting(RateLimitPolicies.Auth);
        group.MapDelete("/coupon", RemoveCouponAsync).WithName("RemoveCoupon");

        return api;
    }

    private static async Task<IResult> GetAsync(
        HttpContext httpContext,
        CartService cart,
        CartOwnerAccessor owner,
        CancellationToken cancellationToken)
    {
        var result = await cart.GetAsync(owner.Resolve(createIfMissing: false), cancellationToken);

        CacheHeaders.Private(httpContext.Response);
        return ApiResults.Ok(result);
    }

    private static async Task<IResult> AddAsync(
        AddToCartRequest request,
        HttpContext httpContext,
        CartService cart,
        CartOwnerAccessor owner,
        CancellationToken cancellationToken)
    {
        var result = await cart.AddAsync(
            owner.Resolve(createIfMissing: true),
            request,
            cancellationToken);

        CacheHeaders.Private(httpContext.Response);
        return ApiResults.Ok(result);
    }

    private static async Task<IResult> UpdateAsync(
        UpdateCartLineRequest request,
        HttpContext httpContext,
        CartService cart,
        CartOwnerAccessor owner,
        CancellationToken cancellationToken)
    {
        var result = await cart.UpdateAsync(
            owner.Resolve(createIfMissing: false),
            request,
            cancellationToken);

        CacheHeaders.Private(httpContext.Response);
        return ApiResults.Ok(result);
    }

    private static async Task<IResult> ApplyCouponAsync(
        ApplyCouponRequest request,
        HttpContext httpContext,
        CartService cart,
        CartOwnerAccessor owner,
        CancellationToken cancellationToken)
    {
        var result = await cart.ApplyCouponAsync(
            owner.Resolve(createIfMissing: false),
            request,
            cancellationToken);

        CacheHeaders.Private(httpContext.Response);
        return ApiResults.Ok(result);
    }

    private static async Task<IResult> RemoveCouponAsync(
        HttpContext httpContext,
        CartService cart,
        CartOwnerAccessor owner,
        CancellationToken cancellationToken)
    {
        var result = await cart.RemoveCouponAsync(
            owner.Resolve(createIfMissing: false),
            cancellationToken);

        CacheHeaders.Private(httpContext.Response);
        return ApiResults.Ok(result);
    }

    private static async Task<IResult> ClearAsync(
        HttpContext httpContext,
        CartService cart,
        CartOwnerAccessor owner,
        CancellationToken cancellationToken)
    {
        var result = await cart.ClearAsync(
            owner.Resolve(createIfMissing: false),
            cancellationToken);

        CacheHeaders.Private(httpContext.Response);
        return ApiResults.Ok(result);
    }
}
