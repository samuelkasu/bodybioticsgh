using System.Security.Claims;
using Microsoft.AspNetCore.Http.HttpResults;
using BodyBiotics.Api.Features.Cart;
using BodyBiotics.Api.Features.Payments;
using BodyBiotics.Api.Http;
using BodyBiotics.Domain.Common;

namespace BodyBiotics.Api.Features.Checkout;

public static class CheckoutEndpoints
{
    public static RouteGroupBuilder MapCheckoutEndpoints(this RouteGroupBuilder api)
    {
        api.MapPost("/checkout", PlaceOrderAsync)
            .WithTags("Checkout")
            .WithName("PlaceOrder")
            // Order creation writes stock; throttle it like the credential endpoints.
            .RequireRateLimiting(RateLimitPolicies.Auth);

        // Public and cacheable: it is a price list, the same for everyone, and
        // the checkout page cannot show a total until it has it.
        api.MapGet("/delivery-options", GetDeliveryOptions)
            .WithTags("Checkout")
            .WithName("GetDeliveryOptions");

        var orders = api.MapGroup("/orders").WithTags("Checkout");

        orders.MapGet("/", ListAsync).WithName("ListOrders").RequireAuthorization();
        // Throttled as well as authorised: a lookup that answers "no such order"
        // is still the endpoint an enumeration script would hammer.
        orders.MapGet("/{reference}", GetAsync)
            .WithName("GetOrder")
            .RequireRateLimiting(RateLimitPolicies.Auth);

        return api;
    }

    private static Ok<ApiEnvelope<DeliveryOptionsDto>> GetDeliveryOptions(HttpContext httpContext)
    {
        CacheHeaders.Catalogue(httpContext.Response);

        return ApiResults.Ok(new DeliveryOptionsDto(
            [.. DeliveryZones.All.Select(zone => new DeliveryZoneDto(
                zone.Code,
                zone.Name,
                zone.FeeMinor,
                zone.Estimate))],
            DeliveryZones.FreeDeliveryThresholdMinor,
            Money.DefaultCurrency));
    }

    private static async Task<IResult> PlaceOrderAsync(
        CheckoutRequest request,
        HttpContext httpContext,
        CheckoutService checkout,
        CartOwnerAccessor owner,
        OrderAccessGrant grant,
        CancellationToken cancellationToken)
    {
        var userId = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier);
        var (order, created) = await checkout.PlaceOrderAsync(
            owner.Resolve(createIfMissing: false),
            userId,
            request,
            cancellationToken);

        // Granted on a replay too: the retry may be coming from a browser that
        // lost the cookie, and it is the same order either way.
        grant.Grant(order.Reference);

        CacheHeaders.Private(httpContext.Response);

        // A replayed request returns 200 with the original order, not 201:
        // nothing was created this time.
        return created
            ? ApiResults.Created(order, $"/api/orders/{order.Reference}")
            : ApiResults.Ok(order);
    }

    private static async Task<IResult> GetAsync(
        string reference,
        HttpContext httpContext,
        CheckoutService checkout,
        OrderAccessGrant grant,
        PaymentService payments,
        CancellationToken cancellationToken)
    {
        var userId = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier);
        var order = await checkout.GetAsync(
            reference,
            userId,
            grant.Holds(reference),
            cancellationToken);

        // The customer is watching this page while Hubtel decides. Asking the
        // provider here means a callback that is late, lost or blocked by a
        // firewall does not leave a paid order showing as unpaid — the access
        // check above has already run, so only someone entitled to this order
        // can trigger it.
        if (order is { PaymentMethod: "HUBTEL", Status: "PENDING" })
        {
            await payments.ReconcileAsync(reference, cancellationToken);

            order = await checkout.GetAsync(
                reference,
                userId,
                grant.Holds(reference),
                cancellationToken);
        }

        CacheHeaders.Private(httpContext.Response);
        return ApiResults.Ok(order);
    }

    private static async Task<IResult> ListAsync(
        HttpContext httpContext,
        CheckoutService checkout,
        CancellationToken cancellationToken)
    {
        var userId = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new ApiException(ApiErrorCode.Unauthorized, "Sign in required");

        var orders = await checkout.ListAsync(userId, cancellationToken);

        CacheHeaders.Private(httpContext.Response);
        return ApiResults.Ok(orders);
    }
}
