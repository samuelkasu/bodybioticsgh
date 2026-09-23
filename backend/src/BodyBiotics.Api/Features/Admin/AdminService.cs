using BodyBiotics.Api.Features.Notifications;
using BodyBiotics.Api.Features.Products;
using BodyBiotics.Api.Http;
using BodyBiotics.Domain.Abstractions;
using BodyBiotics.Domain.Common;
using BodyBiotics.Domain.Entities;
using FluentValidation;

namespace BodyBiotics.Api.Features.Admin;

/// <summary>
/// The shop's own view of its orders and catalogue. Everything here is behind
/// the admin policy; nothing in it is reachable by a customer.
/// </summary>
public sealed class AdminService(
    IAdminRepository admin,
    OrderNotifier notifications,
    Promotions.PricingService pricing,
    IValidator<UpdateOrderStatusRequest> statusValidator,
    IValidator<UpdateProductRequest> productValidator,
    IValidator<DispatchOrderRequest> dispatchValidator,
    IValidator<CompleteDeliveryRequest> deliveredValidator,
    IValidator<FailDeliveryRequest> failedValidator,
    IValidator<RecordRefundRequest> refundValidator)
{
    /// <summary>Same ceiling as the storefront: an unbounded page is a data dump.</summary>
    public const int MaxPerPage = 100;

    public async Task<PagedDto<AdminOrderDto>> ListOrdersAsync(
        string? status,
        string? search,
        DateTimeOffset? from,
        DateTimeOffset? to,
        int page,
        int perPage,
        CancellationToken cancellationToken)
    {
        var wanted = ParseStatusFilter(status);
        var safePage = Math.Max(1, page);
        var safePerPage = Math.Clamp(perPage, 1, MaxPerPage);

        // A date picker sends a day, not an instant. Taken literally, "to"
        // would exclude every order placed on the day staff asked for, so both
        // ends widen to cover the whole day.
        DateTimeOffset? since = from is { } first
            ? new DateTimeOffset(first.Date, first.Offset)
            : null;
        DateTimeOffset? until = to is { } last
            ? new DateTimeOffset(last.Date.AddDays(1).AddTicks(-1), last.Offset)
            : null;

        var result = await admin.ListOrdersAsync(
            wanted,
            search,
            since,
            until,
            safePage,
            safePerPage,
            cancellationToken);

        return new PagedDto<AdminOrderDto>(
            [.. result.Items.Select(ToDto)],
            result.Page,
            result.PerPage,
            result.Total);
    }

    public async Task<AdminOrderDto> GetOrderAsync(
        string reference,
        CancellationToken cancellationToken)
    {
        var order = await admin.FindOrderAsync(reference, cancellationToken)
            ?? throw new ApiException(ApiErrorCode.NotFound, $"No order {reference}");

        return ToDto(order);
    }

    /// <summary>
    /// Moves an order through the state machine on the entity, so the same
    /// transitions a payment webhook will use apply to a member of staff.
    /// Cancelling returns the reserved stock to the catalogue — checkout takes
    /// it when the order is placed, and nothing else gives it back.
    /// </summary>
    public async Task<AdminOrderDto> UpdateOrderStatusAsync(
        string reference,
        UpdateOrderStatusRequest request,
        CancellationToken cancellationToken)
    {
        await statusValidator.ValidateAndThrowAsync(request, cancellationToken);

        var next = ParseStatus(request.Status);

        // These three carry details a bare status cannot: who took it, what
        // they collected, how much went back. Each has its own action.
        var instead = next switch
        {
            OrderStatus.Dispatched => "Use Dispatch, which records who is taking it.",
            OrderStatus.Fulfilled => "Use Mark delivered on an order that is out for delivery.",
            OrderStatus.Refunded => "Use Record refund, which records the amount and how it was returned.",
            _ => null,
        };

        if (instead is not null)
        {
            throw new ApiException(ApiErrorCode.BadRequest, instead);
        }

        var order = await FindAsync(reference, cancellationToken);

        if (order.Status == OrderStatus.Dispatched)
        {
            // The state machine lets a dispatched order fall back to Paid or
            // Pending, but only through TryFailDelivery, which closes the trip.
            throw new ApiException(
                ApiErrorCode.Conflict,
                "This order is out for delivery. Mark it delivered or failed first.");
        }

        var previous = order.Status;
        var wasOpen = order.Status is OrderStatus.Pending or OrderStatus.Paid;

        if (!order.TryTransitionTo(next))
        {
            throw new ApiException(
                ApiErrorCode.Conflict,
                $"An order that is {order.Status.ToString().ToUpperInvariant()} cannot become {next.ToString().ToUpperInvariant()}.");
        }

        // `wasOpen` rather than reading the status again: TryTransitionTo
        // reports success for a re-applied transition, and releasing stock
        // twice for the same cancellation would invent inventory.
        if (next == OrderStatus.Cancelled && wasOpen)
        {
            foreach (var item in order.Items)
            {
                item.Product?.Release(item.Quantity);
            }

            // The code goes back too, for the same reason and with the same
            // guard: a customer whose order the shop cancelled has not used up
            // their one-per-person discount.
            await pricing.ReleaseRedemptionAsync(order, cancellationToken);
        }

        // Staff marking an order paid means the money arrived outside Hubtel —
        // a pay-on-delivery order settled early, or a transfer. The full total.
        if (next == OrderStatus.Paid && previous == OrderStatus.Pending)
        {
            order.RecordPayment(order.TotalMinor, DateTimeOffset.UtcNow);
        }

        await admin.SaveChangesAsync(cancellationToken);
        NotifyCustomer(order, previous);
        return ToDto(order);
    }

    /// <summary>
    /// Sends the order out with a rider or courier. The trip and the status
    /// change are one save: an order must never read "out for delivery" with
    /// nobody recorded as carrying it.
    /// </summary>
    public async Task<AdminOrderDto> DispatchAsync(
        string reference,
        DispatchOrderRequest request,
        CancellationToken cancellationToken)
    {
        await dispatchValidator.ValidateAndThrowAsync(request, cancellationToken);
        // Already checked by the validator; parsed again for the value.
        if (!TryParseDeliveryMethod(request.Method, out var method))
        {
            throw new ApiException(ApiErrorCode.BadRequest, "Method must be RIDER or COURIER.");
        }

        var order = await FindAsync(reference, cancellationToken);

        if (order.ActiveDelivery is { } active)
        {
            throw new ApiException(
                ApiErrorCode.Conflict,
                $"This order is already out with {active.RiderName}. Mark that trip delivered or failed first.");
        }

        if (order.Status == OrderStatus.Pending && order.PaymentMethod == PaymentMethod.Hubtel)
        {
            throw new ApiException(
                ApiErrorCode.Conflict,
                "This order is waiting for its online payment. It can go out once it is paid.");
        }

        var delivery = new Delivery
        {
            Id = Identifier.New(),
            OrderId = order.Id,
            Method = method,
            CourierName = method == DeliveryMethod.Courier ? request.CourierName?.Trim() : null,
            RiderName = request.RiderName.Trim(),
            RiderPhone = request.RiderPhone.Trim(),
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
        };

        if (!order.TryDispatch(delivery))
        {
            throw new ApiException(
                ApiErrorCode.Conflict,
                $"An order that is {Describe(order.Status)} cannot go out for delivery.");
        }

        await admin.SaveChangesAsync(cancellationToken);
        notifications.Dispatched(order, delivery);
        return ToDto(order);
    }

    public async Task<AdminOrderDto> CompleteDeliveryAsync(
        string reference,
        CompleteDeliveryRequest request,
        CancellationToken cancellationToken)
    {
        await deliveredValidator.ValidateAndThrowAsync(request, cancellationToken);

        var order = await FindAsync(reference, cancellationToken);

        if (order.Status != OrderStatus.Dispatched || order.ActiveDelivery is null)
        {
            throw new ApiException(
                ApiErrorCode.Conflict,
                "Only an order that is out for delivery can be marked delivered.");
        }

        if (order.PaidAt is null)
        {
            if (request.CollectedMinor is not { } collected)
            {
                throw new ApiException(
                    ApiErrorCode.BadRequest,
                    "This order is pay on delivery. Enter what the rider collected — " +
                    $"{Money.Format(order.TotalMinor, order.Currency)} was due.");
            }

            // More than the total is a typo, not a tip: it would also lift the
            // refund ceiling above anything the customer was charged.
            if (collected > order.TotalMinor)
            {
                throw new ApiException(
                    ApiErrorCode.BadRequest,
                    $"That is more than the order total of {Money.Format(order.TotalMinor, order.Currency)}.");
            }
        }

        // An order paid online ignores any collected figure: nothing changed hands.
        var collectedMinor = order.PaidAt is null ? request.CollectedMinor : null;
        var collectedVia = order.PaidAt is null ? request.CollectedVia : null;

        if (!order.TryCompleteDelivery(DateTimeOffset.UtcNow, collectedMinor, collectedVia))
        {
            throw new ApiException(ApiErrorCode.Conflict, "That delivery could not be closed.");
        }

        await admin.SaveChangesAsync(cancellationToken);
        notifications.Fulfilled(order);
        return ToDto(order);
    }

    /// <summary>
    /// The customer was out, the address was wrong. The trip is kept with its
    /// reason and the order goes back to where it was, to be sent again or
    /// cancelled. No email: staff ring the customer about this one.
    /// </summary>
    public async Task<AdminOrderDto> FailDeliveryAsync(
        string reference,
        FailDeliveryRequest request,
        CancellationToken cancellationToken)
    {
        await failedValidator.ValidateAndThrowAsync(request, cancellationToken);

        var order = await FindAsync(reference, cancellationToken);

        if (!order.TryFailDelivery(request.Reason.Trim(), DateTimeOffset.UtcNow))
        {
            throw new ApiException(
                ApiErrorCode.Conflict,
                "Only an order that is out for delivery can be marked as failed.");
        }

        await admin.SaveChangesAsync(cancellationToken);
        return ToDto(order);
    }

    /// <summary>
    /// Records a refund staff have already sent, and puts any returned units
    /// back on sale. The refund row, the order's running total, its status and
    /// the stock are one save: a refund recorded without its restock, or a
    /// restock without its refund, is how the books and the shelves drift
    /// apart. The order's concurrency token stops two refunds entered at once
    /// from both fitting under the same ceiling.
    /// </summary>
    public async Task<AdminOrderDto> RecordRefundAsync(
        string reference,
        RecordRefundRequest request,
        CancellationToken cancellationToken)
    {
        await refundValidator.ValidateAndThrowAsync(request, cancellationToken);
        if (!TryParseRefundMethod(request.Method, out var method))
        {
            throw new ApiException(
                ApiErrorCode.BadRequest,
                "Method must be MOBILE_MONEY, CASH, HUBTEL or BANK_TRANSFER.");
        }

        var order = await FindAsync(reference, cancellationToken);

        if (order.Status is not (OrderStatus.Paid or OrderStatus.Fulfilled))
        {
            throw new ApiException(
                ApiErrorCode.Conflict,
                order.Status == OrderStatus.Dispatched
                    ? "This order is out for delivery. Mark it delivered or failed before refunding."
                    : $"Refunds are recorded against a paid order. This one is {Describe(order.Status)}.");
        }

        if (request.AmountMinor > order.RefundableMinor)
        {
            throw new ApiException(
                ApiErrorCode.Conflict,
                $"At most {Money.Format(order.RefundableMinor, order.Currency)} can be refunded: " +
                $"{Money.Format(order.AmountPaidMinor, order.Currency)} was paid and " +
                $"{Money.Format(order.RefundedMinor, order.Currency)} has already gone back.");
        }

        var restock = request.Restock ?? [];

        // Every line checked before any is applied, so one bad line refuses
        // the whole refund rather than half-restocking it.
        foreach (var line in restock)
        {
            var item = order.Items.FirstOrDefault(candidate => candidate.ProductId == line.ProductId)
                ?? throw new ApiException(
                    ApiErrorCode.BadRequest,
                    $"Product {line.ProductId} is not on this order.");

            var remaining = item.Quantity - item.RestockedQuantity;
            if (line.Quantity > remaining)
            {
                throw new ApiException(
                    ApiErrorCode.BadRequest,
                    $"Only {remaining} of {item.Product?.Name ?? "that product"} can go back to stock.");
            }
        }

        foreach (var line in restock)
        {
            var item = order.Items.First(candidate => candidate.ProductId == line.ProductId);
            item.TryRestock(line.Quantity);
            item.Product?.Release(line.Quantity);
        }

        var refund = new Refund
        {
            Id = Identifier.New(),
            OrderId = order.Id,
            AmountMinor = request.AmountMinor,
            Method = method,
            Reason = request.Reason.Trim(),
            Reference = string.IsNullOrWhiteSpace(request.Reference) ? null : request.Reference.Trim(),
            RestockedUnits = restock.Sum(line => line.Quantity),
        };

        if (!order.TryAddRefund(refund))
        {
            throw new ApiException(ApiErrorCode.Conflict, "That refund could not be recorded.");
        }

        await admin.SaveChangesAsync(cancellationToken);
        notifications.Refunded(order, refund);
        return ToDto(order);
    }

    public static bool TryParseDeliveryMethod(string? value, out DeliveryMethod method) =>
        Enum.TryParse(value?.Replace("_", string.Empty), ignoreCase: true, out method)
        && Enum.IsDefined(method);

    public static bool TryParseRefundMethod(string? value, out RefundMethod method) =>
        Enum.TryParse(value?.Replace("_", string.Empty), ignoreCase: true, out method)
        && Enum.IsDefined(method);

    private async Task<Order> FindAsync(string reference, CancellationToken cancellationToken) =>
        await admin.FindOrderAsync(reference, cancellationToken)
            ?? throw new ApiException(ApiErrorCode.NotFound, $"No order {reference}");

    private static string Describe(OrderStatus status) => status switch
    {
        OrderStatus.Dispatched => "out for delivery",
        OrderStatus.Fulfilled => "delivered",
        _ => status.ToString().ToLowerInvariant(),
    };

    /// <summary>
    /// Emails the customer about a change they would otherwise only learn about
    /// from a phone call. Compares against the status before the transition, so
    /// re-applying one — which <see cref="Order.TryTransitionTo"/> accepts —
    /// does not send a second copy.
    /// </summary>
    private void NotifyCustomer(Order order, OrderStatus previous)
    {
        if (order.Status == previous)
        {
            return;
        }

        switch (order.Status)
        {
            case OrderStatus.Paid:
                // Only for an order that was actually paid online. Marking a
                // pay-on-delivery order Paid means the rider collected the
                // money at the door, and thanking the customer for a payment
                // they just handed over in person reads as a mistake.
                if (order.PaymentMethod == PaymentMethod.Hubtel)
                {
                    notifications.Paid(order);
                }

                break;

            case OrderStatus.Cancelled:
                notifications.Cancelled(order);
                break;

            case OrderStatus.Fulfilled:
            case OrderStatus.Dispatched:
            case OrderStatus.Refunded:
            case OrderStatus.Pending:
            default:
                // Delivery and refunds have their own actions, which send their
                // own emails with details this path does not have.
                break;
        }
    }

    public async Task<PagedDto<AdminProductDto>> ListProductsAsync(
        string? search,
        int page,
        int perPage,
        CancellationToken cancellationToken)
    {
        var result = await admin.ListProductsAsync(
            search,
            Math.Max(1, page),
            Math.Clamp(perPage, 1, MaxPerPage),
            cancellationToken);

        return new PagedDto<AdminProductDto>(
            [.. result.Items.Select(AdminProductDto.From)],
            result.Page,
            result.PerPage,
            result.Total);
    }

    public async Task<AdminProductDto> UpdateProductAsync(
        string productId,
        UpdateProductRequest request,
        CancellationToken cancellationToken)
    {
        await productValidator.ValidateAndThrowAsync(request, cancellationToken);

        var product = await admin.FindProductAsync(productId, cancellationToken)
            ?? throw new ApiException(ApiErrorCode.NotFound, "No such product");

        // Compare-and-set, checked before anything is applied so the refusal
        // carries the product exactly as it is. A plain overwrite would undo
        // every order placed or cancelled since the form loaded: stock 10,
        // three sell, and saving "10" puts three units that do not exist back
        // on sale.
        if (request.Stock.HasValue && product.Stock != request.ExpectedStock)
        {
            throw new ApiException(
                ApiErrorCode.Conflict,
                $"Stock changed from {request.ExpectedStock} to {product.Stock} while you were editing, " +
                "from orders placed or cancelled in the meantime. Nothing was saved — check the number and save again.",
                AdminProductDto.From(product));
        }

        if (request.PriceMinor is { } price)
        {
            product.PriceMinor = price;
        }

        if (request.Stock is { } stock)
        {
            product.Stock = stock;
        }

        if (request.Active is { } active)
        {
            product.Active = active;
        }

        // Cleared before anything is set, so one request can end a sale and
        // start the next one.
        if (request.ClearSale == true)
        {
            product.SalePriceMinor = null;
            product.SaleStartsAt = null;
            product.SaleEndsAt = null;
        }

        if (request.SalePriceMinor is { } salePrice)
        {
            product.SalePriceMinor = salePrice;
        }

        if (request.SaleStartsAt is { } startsAt)
        {
            product.SaleStartsAt = startsAt;
        }

        if (request.SaleEndsAt is { } endsAt)
        {
            product.SaleEndsAt = endsAt;
        }

        // Checked against the saved row, not only against the request: a patch
        // that sets a sale price without resending the shelf price gets past
        // the validator's cross-field rule, and "on sale for more than it
        // normally costs" has to be impossible, not merely ignored.
        if (product.SalePriceMinor is { } sale && sale >= product.PriceMinor)
        {
            throw new ApiException(
                ApiErrorCode.BadRequest,
                "A sale price must be below the normal price.");
        }

        if (product.SaleStartsAt is { } start
            && product.SaleEndsAt is { } end
            && end <= start)
        {
            throw new ApiException(
                ApiErrorCode.BadRequest,
                "A sale cannot end before it starts.");
        }

        await admin.SaveChangesAsync(cancellationToken);
        return AdminProductDto.From(product);
    }

    private static OrderStatus? ParseStatusFilter(string? status) =>
        string.IsNullOrWhiteSpace(status) || status.Equals("all", StringComparison.OrdinalIgnoreCase)
            ? null
            : ParseStatus(status);

    private static OrderStatus ParseStatus(string status) =>
        Enum.TryParse<OrderStatus>(status, ignoreCase: true, out var parsed)
            ? parsed
            : throw new ApiException(
                ApiErrorCode.BadRequest,
                $"Unknown status \"{status}\". Expected one of: {string.Join(", ", Enum.GetNames<OrderStatus>())}.");

    private static AdminOrderDto ToDto(Order order) => new(
        order.Reference,
        order.Status.ToString().ToUpperInvariant(),
        order.Email,
        order.FullName,
        order.Phone,
        order.AddressLine,
        order.City,
        order.DeliveryZoneName,
        order.Notes,
        order.SubtotalMinor > 0 ? order.SubtotalMinor : order.TotalMinor,
        order.DiscountMinor,
        order.CouponCode,
        order.DiscountDescription,
        order.DeliveryFeeMinor,
        order.TotalMinor,
        order.Currency,
        order.Items.Sum(item => item.Quantity),
        order.CreatedAt,
        order.UpdatedAt,
        [.. order.Items.Select(item => new AdminOrderLineDto(
            item.ProductId,
            item.Product?.Slug ?? string.Empty,
            item.Product?.Name ?? "Product",
            item.UnitPriceMinor,
            item.Quantity,
            item.LineTotalMinor,
            item.DiscountMinor,
            item.RestockedQuantity))],
        order.PaymentMethod == PaymentMethod.Hubtel ? "HUBTEL" : "ON_DELIVERY",
        order.PaidAt,
        order.AmountPaidMinor,
        order.RefundedMinor,
        order.RefundableMinor,
        [.. order.Deliveries
            .OrderBy(delivery => delivery.DispatchedAt)
            .Select(delivery => new AdminDeliveryDto(
                delivery.Id,
                delivery.Method.ToString().ToUpperInvariant(),
                delivery.CourierName,
                delivery.RiderName,
                delivery.RiderPhone,
                delivery.Notes,
                delivery.Status == DeliveryStatus.OutForDelivery
                    ? "OUT_FOR_DELIVERY"
                    : delivery.Status.ToString().ToUpperInvariant(),
                delivery.DispatchedAt,
                delivery.DeliveredAt,
                delivery.FailedAt,
                delivery.FailureReason,
                delivery.CollectedMinor,
                delivery.CollectedVia))],
        [.. order.Refunds
            .OrderBy(refund => refund.CreatedAt)
            .Select(refund => new AdminRefundDto(
                refund.Id,
                refund.AmountMinor,
                refund.Method switch
                {
                    RefundMethod.MobileMoney => "MOBILE_MONEY",
                    RefundMethod.BankTransfer => "BANK_TRANSFER",
                    _ => refund.Method.ToString().ToUpperInvariant(),
                },
                refund.Reason,
                refund.Reference,
                refund.RestockedUnits,
                refund.CreatedAt))]);
}
