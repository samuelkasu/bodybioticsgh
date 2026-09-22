using BodyBiotics.Api.Features.Notifications;
using BodyBiotics.Api.Features.Products;
using BodyBiotics.Api.Http;
using BodyBiotics.Domain.Abstractions;
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
    IValidator<UpdateProductRequest> productValidator)
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

        var order = await admin.FindOrderAsync(reference, cancellationToken)
            ?? throw new ApiException(ApiErrorCode.NotFound, $"No order {reference}");

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

        await admin.SaveChangesAsync(cancellationToken);
        NotifyCustomer(order, previous);
        return ToDto(order);
    }

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

            case OrderStatus.Fulfilled:
                notifications.Fulfilled(order);
                break;

            case OrderStatus.Cancelled:
                notifications.Cancelled(order);
                break;

            case OrderStatus.Refunded:
            case OrderStatus.Pending:
            default:
                // Refunds are still arranged by hand, so the person issuing one
                // is already talking to the customer. Nothing automated to add.
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
            item.DiscountMinor))]);
}
