using BodyBiotics.Api.Features.Notifications;
using FluentValidation;

namespace BodyBiotics.Api.Features.Contact;

/// <summary>
/// Validates a contact enquiry and forwards it to the shop's inbox.
///
/// It is still logged as well. The log line is the record that a message
/// arrived even if mail is misconfigured or the provider drops it, and it
/// carries no body — an enquiry can contain anything a customer felt like
/// typing, including an order number and a phone number.
/// </summary>
public sealed partial class ContactService(
    IValidator<ContactRequest> validator,
    OrderNotifier notifications,
    ILogger<ContactService> logger)
{
    public async Task SubmitAsync(ContactRequest request, CancellationToken cancellationToken)
    {
        await validator.ValidateAndThrowAsync(request, cancellationToken);

        notifications.ContactEnquiry(
            request.Name.Trim(),
            request.Email.Trim(),
            request.Subject.ToString(),
            request.Message.Trim());

        LogEnquiry(logger, request.Subject, request.Email, request.Message.Length);
    }

    [LoggerMessage(
        Level = LogLevel.Information,
        Message = "Contact enquiry received: {Subject} from {Email} ({Length} chars)")]
    private static partial void LogEnquiry(
        ILogger logger,
        ContactSubject subject,
        string email,
        int length);
}
