using BodyBiotics.Api.Features.Notifications;
using BodyBiotics.Api.Http;
using BodyBiotics.Domain.Abstractions;
using BodyBiotics.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace BodyBiotics.Api.Features.Payments;

/// <summary>
/// Settles an order against what the provider says.
///
/// The callback carries no signature, so nothing in its body is believed. It is
/// used for one thing only: to learn which order reference to go and ask about.
/// The answer to that question — from Hubtel's own status endpoint — is what
/// moves an order to Paid.
/// </summary>
public sealed partial class PaymentService(
    IAdminRepository orders,
    IUnitOfWork unitOfWork,
    IPaymentGateway gateway,
    OrderNotifier notifications,
    ILogger<PaymentService> logger)
{
    /// <summary>
    /// Safe to call repeatedly and from anywhere: the callback, the order page
    /// polling while the customer waits, and any later reconciliation all go
    /// through here. Returns the order's settled state.
    /// </summary>
    public async Task<OrderStatus> ReconcileAsync(
        string reference,
        CancellationToken cancellationToken)
    {
        var order = await orders.FindOrderAsync(reference, cancellationToken);

        if (order is null)
        {
            // A reference we never issued. This is what a forged or misdirected
            // callback looks like, so it is worth a line in the log.
            LogUnknownReference(logger, reference);
            throw new ApiException(ApiErrorCode.NotFound, "No such order");
        }

        // Only an unsettled online order has anything to reconcile. Re-running
        // against a paid or cancelled order is a no-op, which is what makes a
        // retried callback harmless.
        if (order.PaymentMethod != PaymentMethod.Hubtel || order.Status != OrderStatus.Pending)
        {
            return order.Status;
        }

        var status = await gateway.GetStatusAsync(reference, cancellationToken);

        switch (status.State)
        {
            case PaymentState.Paid:
                // The amount is checked, not assumed: a provider echoing a
                // different figure means something is wrong, and quietly
                // fulfilling an underpaid order is how a shop loses money.
                if (status.AmountMinor != order.TotalMinor)
                {
                    LogAmountMismatch(logger, reference, order.TotalMinor, status.AmountMinor);
                    return order.Status;
                }

                return await SettleAsync(reference, status, cancellationToken);

            case PaymentState.Failed:
                return await SettleAsync(reference, status, cancellationToken);

            case PaymentState.Pending:
            case PaymentState.Unknown:
            default:
                // Left alone on purpose. A customer who is still on Hubtel's
                // page, or a reference the provider has not registered yet,
                // must not have their order cancelled out from under them.
                return order.Status;
        }
    }

    /// <summary>
    /// Writes the provider's verdict. The callback and the order page often
    /// reconcile the same payment at the same moment, and a failed payment
    /// releases stock another checkout may be taking, so this goes through the
    /// unit of work: losing either race reruns it against the fresh rows rather
    /// than failing. The gateway is not asked again — its answer does not change
    /// because a write here lost a race.
    /// </summary>
    private async Task<OrderStatus> SettleAsync(
        string reference,
        PaymentStatus status,
        CancellationToken cancellationToken)
    {
        var (order, settled) = await unitOfWork.InTransactionAsync(
            async token =>
            {
                // Reloaded: a rerun starts with nothing tracked, and whoever
                // beat the last attempt may have settled the order already.
                var order = await orders.FindOrderAsync(reference, token)
                    ?? throw new ApiException(ApiErrorCode.NotFound, "No such order");

                if (order.Status != OrderStatus.Pending)
                {
                    return (order, false);
                }

                if (status.State == PaymentState.Paid)
                {
                    order.TryTransitionTo(OrderStatus.Paid);
                    order.RecordPayment(status.AmountMinor, DateTimeOffset.UtcNow);
                    order.PaymentChannel = status.Channel;

                    if (!string.IsNullOrWhiteSpace(status.ProviderTransactionId))
                    {
                        order.PaymentReference = status.ProviderTransactionId;
                    }
                }
                else
                {
                    // A failed payment gives the stock back, exactly as an
                    // admin cancellation does — checkout took it when the
                    // order was placed.
                    order.TryTransitionTo(OrderStatus.Cancelled);

                    foreach (var item in order.Items)
                    {
                        item.Product?.Release(item.Quantity);
                    }
                }

                await orders.SaveChangesAsync(token);
                return (order, true);
            },
            cancellationToken);

        // Only for the attempt that actually moved the order, so the callback
        // and the order page both reconciling does not send two emails.
        if (settled && order.Status == OrderStatus.Paid)
        {
            notifications.Paid(order);
            LogPaid(logger, reference);
        }
        else if (settled)
        {
            notifications.Cancelled(order);
            LogFailed(logger, reference);
        }

        return order.Status;
    }

    [LoggerMessage(
        Level = LogLevel.Warning,
        Message = "Payment callback named {Reference}, which is not an order we issued")]
    private static partial void LogUnknownReference(ILogger logger, string reference);

    [LoggerMessage(
        Level = LogLevel.Error,
        Message = "Payment for {Reference} reported {PaidMinor} against an order of {ExpectedMinor}; left unsettled")]
    private static partial void LogAmountMismatch(
        ILogger logger,
        string reference,
        int expectedMinor,
        int paidMinor);

    [LoggerMessage(Level = LogLevel.Information, Message = "Order {Reference} settled as paid")]
    private static partial void LogPaid(ILogger logger, string reference);

    [LoggerMessage(
        Level = LogLevel.Information,
        Message = "Payment for {Reference} failed; order cancelled and stock released")]
    private static partial void LogFailed(ILogger logger, string reference);
}
