using BodyBiotics.Domain.Abstractions;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MimeKit;

namespace BodyBiotics.Infrastructure.Email;

/// <summary>
/// Sends one message per connection. Transactional volume here is a handful of
/// messages a day, so pooling a connection would mostly mean holding an idle
/// socket open for a provider to time out from under us.
/// </summary>
public sealed partial class SmtpEmailSender(
    IOptions<EmailOptions> options,
    ILogger<SmtpEmailSender> logger) : IEmailSender
{
    private readonly EmailOptions _options = options.Value;

    public bool IsConfigured => _options.IsConfigured;

    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        if (!IsConfigured)
        {
            // Nothing is wired yet. Log the subject and recipient so a developer
            // can still see the flow working end to end, and never the body —
            // a password-reset link in the application log is a live credential.
            LogNotConfigured(logger, message.Subject, message.To);
            return;
        }

        var mime = new MimeMessage
        {
            Subject = message.Subject,
            Body = new BodyBuilder
            {
                HtmlBody = message.HtmlBody,
                TextBody = message.TextBody,
            }.ToMessageBody(),
        };

        mime.From.Add(new MailboxAddress(_options.FromName, _options.FromAddress));
        mime.To.Add(MailboxAddress.Parse(message.To));

        if (!string.IsNullOrWhiteSpace(message.ReplyTo))
        {
            mime.ReplyTo.Add(MailboxAddress.Parse(message.ReplyTo));
        }

        using var client = new SmtpClient();

        // 465 is implicit TLS; 587 negotiates up from plaintext. Getting this
        // backwards fails with a protocol error rather than falling back.
        var security = _options.Port == 465
            ? SecureSocketOptions.SslOnConnect
            : _options.UseStartTls
                ? SecureSocketOptions.StartTls
                : SecureSocketOptions.None;

        await client.ConnectAsync(_options.Host, _options.Port, security, cancellationToken);

        if (!string.IsNullOrWhiteSpace(_options.UserName))
        {
            await client.AuthenticateAsync(_options.UserName, _options.Password, cancellationToken);
        }

        await client.SendAsync(mime, cancellationToken);
        await client.DisconnectAsync(quit: true, cancellationToken);
    }

    [LoggerMessage(
        Level = LogLevel.Warning,
        Message = "No mail provider configured, so \"{Subject}\" for {Recipient} was not sent. " +
            "Set Email:Host and Email:FromAddress.")]
    private static partial void LogNotConfigured(ILogger logger, string subject, string recipient);
}
