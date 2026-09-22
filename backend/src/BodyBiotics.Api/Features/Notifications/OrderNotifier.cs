using BodyBiotics.Domain.Abstractions;
using BodyBiotics.Domain.Entities;
using BodyBiotics.Infrastructure.Email;
using Microsoft.Extensions.Options;

namespace BodyBiotics.Api.Features.Notifications;

/// <summary>
/// The one place that decides which email an order's state change produces.
///
/// Nothing here awaits delivery or throws: the order is already committed by
/// the time any of these are called, and a mail provider having a bad minute
/// must not turn a placed order into an error the customer sees.
/// </summary>
public sealed class OrderNotifier(EmailOutbox outbox, IOptions<EmailOptions> options)
{
    private readonly EmailOptions _options = options.Value;

    /// <summary>
    /// Sent when the order is written. For pay-on-delivery that is the whole
    /// story; for an online payment it is a receipt of intent, and
    /// <see cref="Paid"/> follows once the money lands.
    ///
    /// The shop is copied separately rather than BCC'd — its email is a
    /// different message, with the phone number and address up front and a
    /// link into the admin queue.
    /// </summary>
    public void Placed(Order order)
    {
        Queue(order.Email, EmailTemplates.OrderPlaced(order, _options.SiteUrl));

        if (!string.IsNullOrWhiteSpace(_options.InboxOrFrom))
        {
            Queue(_options.InboxOrFrom, EmailTemplates.NewOrderForShop(order, _options.SiteUrl), replyTo: order.Email);
        }
    }

    public void Paid(Order order) =>
        Queue(order.Email, EmailTemplates.OrderPaid(order, _options.SiteUrl));

    public void Fulfilled(Order order) =>
        Queue(order.Email, EmailTemplates.OrderFulfilled(order, _options.SiteUrl));

    public void Cancelled(Order order) =>
        Queue(order.Email, EmailTemplates.OrderCancelled(order, _options.SiteUrl));

    public void ContactEnquiry(string name, string email, string subject, string message)
    {
        if (string.IsNullOrWhiteSpace(_options.InboxOrFrom))
        {
            return;
        }

        // Reply-to is the customer, so answering the enquiry is one keystroke
        // rather than a copy-paste of the address out of the body.
        Queue(
            _options.InboxOrFrom,
            EmailTemplates.ContactEnquiry(name, email, subject, message),
            replyTo: email);
    }

    public void PasswordReset(string email, string resetUrl, int validMinutes) =>
        Queue(email, EmailTemplates.PasswordReset(resetUrl, validMinutes));

    private void Queue(
        string to,
        (string Subject, string Html, string Text) template,
        string? replyTo = null) =>
        outbox.Enqueue(new EmailMessage(to, template.Subject, template.Html, template.Text, replyTo));
}
