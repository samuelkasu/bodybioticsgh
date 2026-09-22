namespace BodyBiotics.Infrastructure.Email;

/// <summary>
/// SMTP rather than a provider-specific API on purpose: Resend, Brevo, Zoho,
/// Mailgun and SendGrid all speak it, so the choice of provider stays a
/// configuration decision instead of a code one.
/// </summary>
public sealed class EmailOptions
{
    public const string SectionName = "Email";

    public string Host { get; init; } = string.Empty;

    public int Port { get; init; } = 587;

    public string UserName { get; init; } = string.Empty;

    public string Password { get; init; } = string.Empty;

    /// <summary>
    /// Port 587 with STARTTLS is the common case. Set false only for port 465,
    /// which is TLS from the first byte; the sender picks that automatically.
    /// </summary>
    public bool UseStartTls { get; init; } = true;

    /// <summary>
    /// The envelope sender. Must be on a domain the provider has verified, or
    /// every message lands in spam regardless of what is in it.
    /// </summary>
    public string FromAddress { get; init; } = string.Empty;

    public string FromName { get; init; } = "Body Biotics GH";

    /// <summary>
    /// Where contact enquiries and new-order alerts go. Falls back to
    /// <see cref="FromAddress"/> so a half-filled configuration still reaches
    /// someone.
    /// </summary>
    public string ShopInbox { get; init; } = string.Empty;

    /// <summary>
    /// Public origin of the storefront, used to build links in emails —
    /// password reset above all. A wrong value here sends customers to a dead
    /// host, so it is configuration rather than a constant.
    /// </summary>
    public string SiteUrl { get; init; } = "http://localhost:3000";

    public string InboxOrFrom => string.IsNullOrWhiteSpace(ShopInbox) ? FromAddress : ShopInbox;

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(Host) && !string.IsNullOrWhiteSpace(FromAddress);
}
