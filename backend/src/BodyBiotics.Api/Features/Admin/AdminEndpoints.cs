using BodyBiotics.Api.Auth;
using BodyBiotics.Api.Http;
using Microsoft.AspNetCore.Mvc;

namespace BodyBiotics.Api.Features.Admin;

public static class AdminEndpoints
{
    public static RouteGroupBuilder MapAdminEndpoints(this RouteGroupBuilder api)
    {
        // The policy is applied to the group, not to each endpoint: a new route
        // added here is protected by default rather than by remembering to.
        var group = api
            .MapGroup("/admin")
            .WithTags("Admin")
            .RequireAuthorization(AuthorizationPolicies.Admin);

        group.MapGet("/orders", ListOrdersAsync).WithName("AdminListOrders");
        group.MapGet("/orders/{reference}", GetOrderAsync).WithName("AdminGetOrder");
        group.MapPost("/orders/{reference}/status", UpdateOrderStatusAsync)
            .WithName("AdminUpdateOrderStatus");
        group.MapGet("/products", ListProductsAsync).WithName("AdminListProducts");
        group.MapPatch("/products/{productId}", UpdateProductAsync)
            .WithName("AdminUpdateProduct");

        return api;
    }

    private static async Task<IResult> ListOrdersAsync(
        HttpContext httpContext,
        AdminService admin,
        CancellationToken cancellationToken,
        [FromQuery] string? status = null,
        [FromQuery] string? search = null,
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        [FromQuery] int page = 1,
        [FromQuery] int perPage = 25)
    {
        var result = await admin.ListOrdersAsync(
            status,
            search,
            from,
            to,
            page,
            perPage,
            cancellationToken);

        // Never cached, anywhere: this is the whole order book.
        CacheHeaders.Private(httpContext.Response);
        return ApiResults.Ok(result);
    }

    private static async Task<IResult> GetOrderAsync(
        string reference,
        HttpContext httpContext,
        AdminService admin,
        CancellationToken cancellationToken)
    {
        var order = await admin.GetOrderAsync(reference, cancellationToken);

        CacheHeaders.Private(httpContext.Response);
        return ApiResults.Ok(order);
    }

    private static async Task<IResult> UpdateOrderStatusAsync(
        string reference,
        UpdateOrderStatusRequest request,
        HttpContext httpContext,
        AdminService admin,
        CancellationToken cancellationToken)
    {
        var order = await admin.UpdateOrderStatusAsync(reference, request, cancellationToken);

        CacheHeaders.Private(httpContext.Response);
        return ApiResults.Ok(order);
    }

    private static async Task<IResult> ListProductsAsync(
        HttpContext httpContext,
        AdminService admin,
        CancellationToken cancellationToken,
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int perPage = 25)
    {
        var result = await admin.ListProductsAsync(search, page, perPage, cancellationToken);

        CacheHeaders.Private(httpContext.Response);
        return ApiResults.Ok(result);
    }

    private static async Task<IResult> UpdateProductAsync(
        string productId,
        UpdateProductRequest request,
        HttpContext httpContext,
        AdminService admin,
        CancellationToken cancellationToken)
    {
        var product = await admin.UpdateProductAsync(productId, request, cancellationToken);

        CacheHeaders.Private(httpContext.Response);
        return ApiResults.Ok(product);
    }
}
