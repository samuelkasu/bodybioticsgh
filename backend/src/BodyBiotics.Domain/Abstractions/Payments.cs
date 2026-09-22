using BodyBiotics.Domain.Entities;

namespace BodyBiotics.Domain.Abstractions;

/// <summary>Where to send the customer to pay, and the id to reconcile against.</summary>
public sealed record PaymentSession(string CheckoutUrl, string CheckoutId);

/// <summary>
/// What the provider says about a transaction when asked directly. Deliberately
/// not the provider's own vocabulary: the callback and the status endpoint word
/// things differently, and both are normalised before they reach the service.
/// </summary>
public enum PaymentState
{
    /// <summary>Started, not resolved. The customer may still be paying.</summary>
    Pending = 0,
    Paid = 1,
    Failed = 2,
    /// <summary>The provider has no record of this reference at all.</summary>
    Unknown = 3,
}

public sealed record PaymentStatus(
    PaymentState State,
    /// <summary>Minor units, so it can be compared against the order without rounding.</summary>
    int AmountMinor,
    string? ProviderTransactionId,
    /// <summary>"mobilemoney", "card" — whatever rail the money came over.</summary>
    string? Channel);

/// <summary>
/// A payment provider, named nowhere in the application services. Hubtel is one
/// implementation; the checkout only knows that something can start a payment
/// and be asked, later and authoritatively, whether it succeeded.
/// </summary>
public interface IPaymentGateway
{
    /// <summary>False when no credentials are configured, so the shop can run
    /// on pay-on-delivery alone without the checkout throwing.</summary>
    bool IsConfigured { get; }

    Task<PaymentSession> StartAsync(Order order, CancellationToken cancellationToken);

    /// <summary>
    /// Asks the provider directly. This — never the callback body — is what
    /// decides that an order is paid: the callback is an unauthenticated POST
    /// to a public URL and is treated only as a nudge to come and check.
    /// </summary>
    Task<PaymentStatus> GetStatusAsync(string clientReference, CancellationToken cancellationToken);
}
