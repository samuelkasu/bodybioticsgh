namespace BodyBiotics.Infrastructure.Payments;

/// <summary>
/// Hubtel Online Checkout, bound from the `Hubtel` section.
///
/// The hosted checkout is used rather than the direct Receive Money prompt, so
/// card details never touch this server and the shop stays out of PCI scope.
///
/// Every secret here belongs in the environment or user-secrets, never in
/// appsettings.json. With nothing configured the gateway reports itself
/// unconfigured and the shop simply keeps taking pay-on-delivery orders.
/// </summary>
public sealed class HubtelOptions
{
    public const string SectionName = "Hubtel";

    /// <summary>Basic auth username for the checkout API — Hubtel's API ID.</summary>
    public string ClientId { get; init; } = string.Empty;

    /// <summary>Basic auth password for the checkout API — Hubtel's API key.</summary>
    public string ClientSecret { get; init; } = string.Empty;

    /// <summary>The POS/merchant account number sales are posted against.</summary>
    public string MerchantAccountNumber { get; init; } = string.Empty;

    /// <summary>
    /// Credentials for the transaction status API. Hubtel issues a separate
    /// pair for it; a 401 on status checks while checkout works usually means
    /// the checkout key was reused here. Left empty, the checkout pair is used.
    /// </summary>
    public string StatusApiId { get; init; } = string.Empty;

    public string StatusApiKey { get; init; } = string.Empty;

    /// <summary>
    /// Base URLs are configuration, not constants: Hubtel has moved these
    /// between hosts before, and a moved endpoint should be a config change
    /// rather than a redeploy.
    /// </summary>
    public string CheckoutBaseUrl { get; init; } = "https://payproxyapi.hubtel.com";

    public string StatusBaseUrl { get; init; } = "https://api-txnstatus.hubtel.com";

    /// <summary>
    /// Shared secret that forms part of the callback path. Hubtel does not sign
    /// its callbacks, so this keeps the endpoint from being trivially
    /// discoverable — it is not the security control. The status re-check is.
    /// </summary>
    public string CallbackSecret { get; init; } = string.Empty;

    /// <summary>Where the customer is sent back to; the storefront's origin.</summary>
    public string SiteUrl { get; init; } = "http://localhost:3000";

    /// <summary>Public origin of this API, for the callback URL Hubtel posts to.</summary>
    public string PublicApiUrl { get; init; } = "http://localhost:5080";

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(ClientId) &&
        !string.IsNullOrWhiteSpace(ClientSecret) &&
        !string.IsNullOrWhiteSpace(MerchantAccountNumber) &&
        !string.IsNullOrWhiteSpace(CallbackSecret);
}
