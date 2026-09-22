namespace BodyBiotics.Domain.Abstractions;

/// <summary>
/// One message, ready to send. Both bodies are always present: a fair number of
/// Ghanaian customers read mail in clients that strip HTML, and an order
/// confirmation that arrives blank is worse than one that arrives plain.
/// </summary>
/// <param name="To">Recipient address.</param>
/// <param name="Subject">Subject line.</param>
/// <param name="HtmlBody">Rich body.</param>
/// <param name="TextBody">Plain-text alternative, never empty.</param>
/// <param name="ReplyTo">
/// Set for forwarded enquiries so hitting reply answers the customer rather
/// than the shop's own sending address.
/// </param>
public sealed record EmailMessage(
    string To,
    string Subject,
    string HtmlBody,
    string TextBody,
    string? ReplyTo = null);

public interface IEmailSender
{
    /// <summary>
    /// False until a host and sender address are configured. Callers use it to
    /// decide whether a feature that depends on mail — password reset — can be
    /// offered at all, rather than silently accepting a request it will drop.
    /// </summary>
    bool IsConfigured { get; }

    Task SendAsync(EmailMessage message, CancellationToken cancellationToken);
}
