using System.Security.Cryptography;
using System.Text;
using BodyBiotics.Api.Features.Checkout;
using BodyBiotics.Api.Http;
using BodyBiotics.Domain.Abstractions;
using BodyBiotics.Infrastructure.Payments;
using Microsoft.Extensions.Options;

namespace BodyBiotics.Api.Features.Payments;

public static class PaymentEndpoints
{
    public static RouteGroupBuilder MapPaymentEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/payments").WithTags("Payments");

        // Lets the checkout page offer online payment only when it will work,
        // rather than sending a customer to a provider that is not set up.
        group.MapGet("/methods", GetMethodsAsync).WithName("GetPaymentMethods");

        // The secret is part of the path because Hubtel signs nothing and sends
        // no credentials. It keeps the endpoint from being casually discovered;
        // it is not what makes this safe. The status re-check in PaymentService
        // is — a caller who guesses the URL still cannot mark anything paid.
        group.MapPost("/hubtel/callback/{secret}", HubtelCallbackAsync)
            .WithName("HubtelCallback")
            .AllowAnonymous()
            .RequireRateLimiting(RateLimitPolicies.Auth);

        return api;
    }

    private static Microsoft.AspNetCore.Http.HttpResults.Ok<ApiEnvelope<PaymentMethodsDto>>
        GetMethodsAsync(HttpContext httpContext, CheckoutService checkout)
    {
        CacheHeaders.Private(httpContext.Response);
        return ApiResults.Ok(new PaymentMethodsDto(
            OnDelivery: true,
            Hubtel: checkout.OnlinePaymentAvailable));
    }

    private static async Task<IResult> HubtelCallbackAsync(
        string secret,
        HubtelPaymentGateway.CallbackPayload payload,
        IOptions<HubtelOptions> options,
        PaymentService payments,
        CancellationToken cancellationToken)
    {
        // Fixed-time comparison: a timing oracle on a path segment is a stretch,
        // but the secret is long-lived and comparing it cheaply costs nothing.
        if (!IsExpectedSecret(secret, options.Value.CallbackSecret))
        {
            return Results.NotFound();
        }

        var reference = payload.Data?.ClientReference;

        if (string.IsNullOrWhiteSpace(reference))
        {
            // 200 regardless: a provider that reads this as a failure will
            // retry the same malformed body forever.
            return Results.Ok();
        }

        try
        {
            await payments.ReconcileAsync(reference, cancellationToken);
        }
        catch (ApiException)
        {
            // An unknown reference is already logged. Still 200 — there is
            // nothing Hubtel can usefully do by retrying.
        }

        return Results.Ok();
    }

    private static bool IsExpectedSecret(string provided, string expected) =>
        !string.IsNullOrEmpty(expected) &&
        CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(provided),
            Encoding.UTF8.GetBytes(expected));
}

public sealed record PaymentMethodsDto(bool OnDelivery, bool Hubtel);
