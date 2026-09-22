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

                if (order.TryTransitionTo(OrderStatus.Paid))
                {
                    order.PaidAt = DateTimeOffset.UtcNow;
                    order.PaymentChannel = status.Channel;

                    if (!string.IsNullOrWhiteSpace(status.ProviderTransactionId))
                    {
                        order.PaymentReference = status.ProviderTransactionId;
                    }

                    await orders.SaveChangesAsync(cancellationToken);
                    // Inside the guard, so the callback and the order page
                    // both reconciling does not send two receipts.
                    notifications.Paid(order);
                    LogPaid(logger, reference);
                }

                break;

            case PaymentState.Failed:
                await CancelAndReleaseAsync(order, cancellationToken);
                break;

            case PaymentState.Pending:
            case PaymentState.Unknown:
            default:
                // Left alone on purpose. A customer who is still on Hubtel's
                // page, or a reference the provider has not registered yet,
                // must not have their order cancelled out from under them.
                break;
        }

        return order.Status;
    }

    /// <summary>
    /// A failed payment gives the stock back, exactly as an admin cancellation
    /// does — checkout took it when the order was placed.
    /// </summary>
    private async Task CancelAndReleaseAsync(Order order, CancellationToken cancellationToken)
    {
        if (!order.TryTransitionTo(OrderStatus.Cancelled))
        {
            return;
        }

        foreach (var item in order.Items)
        {
            item.Product?.Release(item.Quantity);
        }

        await orders.SaveChangesAsync(cancellationToken);
        notifications.Cancelled(order);
        LogFailed(logger, order.Reference);
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
