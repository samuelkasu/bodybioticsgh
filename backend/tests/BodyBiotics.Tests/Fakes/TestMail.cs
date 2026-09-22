using BodyBiotics.Api.Features.Notifications;
using BodyBiotics.Domain.Abstractions;
using BodyBiotics.Infrastructure.Email;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace BodyBiotics.Tests.Fakes;

/// <summary>
/// A real <see cref="OrderNotifier"/> over a real <see cref="EmailOutbox"/>,
/// with the queue read back instead of drained by the dispatcher.
///
/// Faking the notifier itself would only assert that a method was called. This
/// asserts what actually lands in the customer's inbox — subject, recipient and
/// body — which is where the mistakes are: the wrong address, an unrendered
/// product name, a receipt sent twice.
/// </summary>
public sealed class TestMail
{
    public TestMail(string siteUrl = "https://bodybioticsgh.com", string shopInbox = "shop@bodybioticsgh.com")
    {
        Outbox = new EmailOutbox(NullLogger<EmailOutbox>.Instance);
        Notifier = new OrderNotifier(
            Outbox,
            Options.Create(new EmailOptions
            {
                Host = "smtp.test",
                FromAddress = "orders@bodybioticsgh.com",
                ShopInbox = shopInbox,
                SiteUrl = siteUrl,
            }));
    }

    public EmailOutbox Outbox { get; }

    public OrderNotifier Notifier { get; }

    /// <summary>Everything queued since the last call, in order.</summary>
    public IReadOnlyList<EmailMessage> Drain()
    {
        var messages = new List<EmailMessage>();

        while (Outbox.Reader.TryRead(out var message))
        {
            messages.Add(message);
        }

        return messages;
    }

    /// <summary>The messages addressed to a customer, ignoring the shop's own copies.</summary>
    public IReadOnlyList<EmailMessage> DrainFor(string recipient) =>
        [.. Drain().Where(message => message.To == recipient)];
}

/// <summary>Records what would have been sent, without a network.</summary>
public sealed class FakeEmailSender(bool configured = true) : IEmailSender
{
    public bool IsConfigured { get; } = configured;

    public List<EmailMessage> Sent { get; } = [];

    public Task SendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        Sent.Add(message);
        return Task.CompletedTask;
    }
}
