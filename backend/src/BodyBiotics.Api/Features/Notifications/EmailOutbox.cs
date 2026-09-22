using System.Threading.Channels;
using BodyBiotics.Domain.Abstractions;

namespace BodyBiotics.Api.Features.Notifications;

/// <summary>
/// Queues mail so no customer-facing request waits on SMTP.
///
/// An order confirmation is not worth failing a checkout for: the order is
/// already written and paid when the message is queued, and a provider that is
/// slow or down must not turn that into a 500 the customer reads as "it did not
/// go through". So enqueuing never blocks and never throws, and delivery
/// happens on <see cref="EmailDispatcher"/>'s thread.
/// </summary>
public sealed partial class EmailOutbox
{
    /// <summary>
    /// Deep enough for any realistic burst — the shop's whole daily volume is
    /// a few dozen messages — and bounded so a wedged provider cannot grow the
    /// queue until the process runs out of memory.
    /// </summary>
    private const int Capacity = 500;

    private readonly Channel<EmailMessage> _queue = Channel.CreateBounded<EmailMessage>(
        new BoundedChannelOptions(Capacity)
        {
            SingleReader = true,
            FullMode = BoundedChannelFullMode.DropWrite,
        });

    private readonly ILogger<EmailOutbox> _logger;

    public EmailOutbox(ILogger<EmailOutbox> logger) => _logger = logger;

    public ChannelReader<EmailMessage> Reader => _queue.Reader;

    public void Enqueue(EmailMessage message)
    {
        if (!_queue.Writer.TryWrite(message))
        {
            // Dropped rather than queued indefinitely. Loud, because a full
            // queue means mail has stopped going out entirely.
            LogDropped(_logger, message.Subject, message.To);
        }
    }

    [LoggerMessage(
        Level = LogLevel.Error,
        Message = "Mail queue is full; dropped \"{Subject}\" for {Recipient}")]
    private static partial void LogDropped(ILogger logger, string subject, string recipient);
}

/// <summary>
/// Drains the outbox. One message at a time on purpose: transactional SMTP
/// providers rate-limit connections, and there is no volume here that needs
/// concurrency.
/// </summary>
public sealed partial class EmailDispatcher(
    EmailOutbox outbox,
    IEmailSender sender,
    ILogger<EmailDispatcher> logger) : BackgroundService
{
    private const int MaxAttempts = 3;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var message in outbox.Reader.ReadAllAsync(stoppingToken))
        {
            await SendWithRetriesAsync(message, stoppingToken);
        }
    }

    private async Task SendWithRetriesAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        for (var attempt = 1; attempt <= MaxAttempts; attempt++)
        {
            try
            {
                await sender.SendAsync(message, cancellationToken);
                return;
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                // Shutting down. The message is lost; retrying into a cancelled
                // token would only stall the host.
                LogAbandoned(logger, message.Subject, message.To);
                return;
            }
            catch (Exception exception)
            {
                if (attempt == MaxAttempts)
                {
                    LogFailed(logger, exception, message.Subject, message.To, attempt);
                    return;
                }

                LogRetrying(logger, message.Subject, attempt);
                await Task.Delay(TimeSpan.FromSeconds(attempt * 5), cancellationToken);
            }
        }
    }

    [LoggerMessage(
        Level = LogLevel.Error,
        Message = "Gave up sending \"{Subject}\" to {Recipient} after {Attempts} attempts")]
    private static partial void LogFailed(
        ILogger logger,
        Exception exception,
        string subject,
        string recipient,
        int attempts);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Retrying \"{Subject}\" after attempt {Attempt}")]
    private static partial void LogRetrying(ILogger logger, string subject, int attempt);

    [LoggerMessage(
        Level = LogLevel.Warning,
        Message = "Shutting down before \"{Subject}\" for {Recipient} could be sent")]
    private static partial void LogAbandoned(ILogger logger, string subject, string recipient);
}
