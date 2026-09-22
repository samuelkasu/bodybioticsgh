using BodyBiotics.Api.Features.Cart;
using BodyBiotics.Api.Features.Notifications;
using BodyBiotics.Api.Features.Promotions;
using BodyBiotics.Api.Http;
using BodyBiotics.Domain.Abstractions;
using BodyBiotics.Domain.Common;
using BodyBiotics.Domain.Entities;
using FluentValidation;

namespace BodyBiotics.Api.Features.Checkout;

/// <summary>
/// Turns a server-side cart into an order. Payment is deliberately out of
/// scope: orders are created <see cref="OrderStatus.Pending"/> and a provider
/// (Paystack / Hubtel Mobile Money) moves them to Paid later.
/// </summary>
public sealed class CheckoutService(
    ICartRepository carts,
    IProductRepository products,
    IOrderRepository orders,
    IUnitOfWork unitOfWork,
    IPaymentGateway payments,
    OrderNotifier notifications,
    PricingService pricing,
    IValidator<CheckoutRequest> validator)
{
    /// <summary>Whether the storefront may offer paying online at all.</summary>
    public bool OnlinePaymentAvailable => payments.IsConfigured;

    private static PaymentMethod ParseMethod(string method) =>
        Enum.TryParse<PaymentMethod>(method.Replace("_", string.Empty), ignoreCase: true, out var parsed)
            ? parsed
            : PaymentMethod.OnDelivery;

    public async Task<(OrderDto Order, bool Created)> PlaceOrderAsync(
        CartOwner owner,
        string? userId,
        CheckoutRequest request,
        CancellationToken cancellationToken)
    {
        await validator.ValidateAndThrowAsync(request, cancellationToken);

        var method = ParseMethod(request.PaymentMethod);

        if (method == PaymentMethod.Hubtel && !payments.IsConfigured)
        {
            throw new ApiException(
                ApiErrorCode.Conflict,
                "Paying online is unavailable at the moment. Choose pay on delivery.");
        }

        // Checked before the transaction so a retry is cheap and cannot
        // re-reserve stock it already holds.
        var replay = await orders.FindByRequestIdAsync(request.RequestId, cancellationToken);
        if (replay is not null)
        {
            return (ToDto(replay), false);
        }

        var cart = await carts.FindAsync(owner, cancellationToken);
        if (cart is null || cart.Items.Count == 0)
        {
            throw new ApiException(ApiErrorCode.BadRequest, "Your cart is empty");
        }

        var order = await unitOfWork.InTransactionAsync(
            async token =>
            {
                // Re-read inside the transaction: price and stock may have
                // changed between the customer loading the page and paying.
                var ids = cart.Items.Select(item => item.ProductId).ToList();
                var catalogue = (await products.FindByIdsAsync(ids, token))
                    .ToDictionary(product => product.Id);

                var created = new Order
                {
                    Id = Identifier.New(),
                    Reference = Identifier.OrderReference(DateTimeOffset.UtcNow),
                    UserId = userId,
                    Email = request.Email.Trim().ToLowerInvariant(),
                    // Kept, not just validated: without these the shop cannot
                    // ring the customer or deliver anything.
                    FullName = request.FullName.Trim(),
                    Phone = request.Phone.Trim(),
                    AddressLine = request.AddressLine.Trim(),
                    City = request.City.Trim(),
                    Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
                    PaymentMethod = method,
                    RequestId = request.RequestId,
                    Currency = Money.DefaultCurrency,
                };

                var now = DateTimeOffset.UtcNow;
                var pricingLines = new List<PricingLine>(cart.Items.Count);

                foreach (var item in cart.Items)
                {
                    if (!catalogue.TryGetValue(item.ProductId, out var product))
                    {
                        throw new ApiException(
                            ApiErrorCode.Conflict,
                            "A product in your cart is no longer available");
                    }

                    if (!product.TryReserve(item.Quantity))
                    {
                        throw new ApiException(
                            ApiErrorCode.Conflict,
                            $"{product.Name} does not have {item.Quantity} left in stock");
                    }

                    created.Items.Add(new OrderItem
                    {
                        Id = Identifier.New(),
                        OrderId = created.Id,
                        ProductId = product.Id,
                        // The navigation too, not only the id: the confirmation
                        // email and the response DTO both read the product name
                        // off it, and an unset nav prints a line reading
                        // "Product" on the customer's receipt.
                        Product = product,
                        // Copied, not referenced: prices change, receipts must
                        // not. The effective price is what is charged, and the
                        // shelf price rides along so the receipt can show what
                        // the sale saved.
                        UnitPriceMinor = product.EffectivePriceMinor(now),
                        ListPriceMinor = product.CompareAtPriceMinor(now),
                        Quantity = item.Quantity,
                    });

                    created.Currency = product.Currency;
                    pricingLines.Add(PricingService.ToLine(product, item.Quantity, now));
                }

                // Re-priced from the catalogue inside the transaction, exactly
                // like the line prices above. The cart quoted the customer a
                // discount; this is the one that is charged, and a campaign
                // that ended in between is not honoured just because the
                // basket still remembers it.
                var priced = await pricing.PriceAsync(
                    pricingLines,
                    cart.CouponCode,
                    request.Email,
                    now,
                    token);

                if (cart.CouponCode is not null && priced.CouponRejected)
                {
                    // Stopped rather than quietly charged at full price: being
                    // billed more than the basket said is the worst way for a
                    // customer to find out their code expired.
                    throw new ApiException(
                        ApiErrorCode.Conflict,
                        PricingService.Explain(priced.Pricing.CouponRejection, priced.Coupon));
                }

                foreach (var line in created.Items)
                {
                    line.DiscountMinor =
                        priced.Pricing.LineDiscountMinor.TryGetValue(line.ProductId, out var share)
                            ? share
                            : 0;
                }

                // Delivery is priced on the discounted goods, and a campaign
                // that waives it outright overrides the threshold. See
                // DeliveryZones.Quote for why it is that way round.
                var quote = DeliveryZones.Quote(
                    priced.Pricing.DiscountedSubtotalMinor,
                    request.DeliveryZone,
                    priced.Pricing.FreeDeliveryGranted);

                created.DeliveryZone = quote.ZoneCode;
                created.DeliveryZoneName = quote.ZoneName;
                created.SubtotalMinor = priced.Pricing.SubtotalMinor;
                created.DiscountMinor = priced.Pricing.DiscountMinor;
                created.CouponCode = priced.Coupon?.Code;
                created.DiscountDescription = Describe(priced);
                created.DeliveryFeeMinor = quote.DeliveryFeeMinor;
                created.TotalMinor = quote.TotalMinor;

                orders.Add(created);

                // Counted inside the transaction, so two checkouts racing for
                // the last use of a code cannot both win: the second commits
                // against a counter the first already moved.
                if (priced.Coupon is { } redeemed)
                {
                    pricing.Redeem(redeemed, created, userId, priced.Pricing.DiscountMinor);
                }

                // The code has been spent on this order; a fresh basket starts
                // without it.
                cart.CouponCode = null;

                cart.Items.Clear();
                cart.UpdatedAt = DateTimeOffset.UtcNow;

                await orders.SaveChangesAsync(token);
                return created;
            },
            cancellationToken);

        // The provider is called after the transaction commits, never inside
        // it: an HTTP round-trip while holding row locks on stock would let a
        // slow gateway stall every other checkout.
        if (method == PaymentMethod.Hubtel)
        {
            // Throws if the gateway refuses, which cancels the order — so the
            // confirmation below is only reached for an order that exists and
            // has somewhere to be paid.
            await StartPaymentAsync(order, cancellationToken);
        }

        notifications.Placed(order);

        return (ToDto(order), true);
    }

    /// <summary>
    /// Asks the gateway for a hosted checkout. If it refuses, the order is
    /// cancelled and its stock returned rather than left Pending forever: an
    /// order nobody can pay for is worse than no order, and the reserved items
    /// would otherwise sit out of the catalogue.
    /// </summary>
    private async Task StartPaymentAsync(Order order, CancellationToken cancellationToken)
    {
        try
        {
            var session = await payments.StartAsync(order, cancellationToken);

            order.PaymentReference = session.CheckoutId;
            order.PaymentCheckoutUrl = session.CheckoutUrl;
            await orders.SaveChangesAsync(cancellationToken);
        }
        catch (Exception exception) when (exception is not ApiException)
        {
            await ReleaseAsync(order, cancellationToken);

            throw new ApiException(
                ApiErrorCode.Conflict,
                "We could not reach the payment provider. Nothing has been charged — " +
                "try again, or choose pay on delivery.");
        }
    }

    /// <summary>
    /// How the saving reads on the receipt. Several campaigns at once are
    /// joined rather than collapsed to "Discount": a customer looking at
    /// GH₵48 off wants to know which offers made it up.
    /// </summary>
    private static string? Describe(PricedCart priced) =>
        priced.Pricing.Discounts.Count == 0
            ? null
            : string.Join(", ", priced.Pricing.Discounts.Select(entry => entry.Label));

    private async Task ReleaseAsync(Order order, CancellationToken cancellationToken)
    {
        if (!order.TryTransitionTo(OrderStatus.Cancelled))
        {
            return;
        }

        // The coupon goes back with the stock. A gateway that refused the
        // payment has not cost the customer their single-use code.
        await pricing.ReleaseRedemptionAsync(order, cancellationToken);

        var ids = order.Items.Select(item => item.ProductId).ToList();
        var catalogue = await products.FindByIdsAsync(ids, cancellationToken);

        foreach (var item in order.Items)
        {
            catalogue
                .FirstOrDefault(product => product.Id == item.ProductId)
                ?.Release(item.Quantity);
        }

        await orders.SaveChangesAsync(cancellationToken);
    }

    public async Task<OrderDto> GetAsync(
        string reference,
        string? userId,
        bool guestAccessGranted,
        CancellationToken cancellationToken)
    {
        var order = await orders.FindByReferenceAsync(
                reference,
                userId,
                guestAccessGranted,
                cancellationToken)
            // Not found rather than forbidden: telling an outsider that a
            // reference exists is half of what they were trying to learn.
            ?? throw new ApiException(ApiErrorCode.NotFound, $"No order {reference}");

        return ToDto(order);
    }

    public async Task<IReadOnlyList<OrderDto>> ListAsync(
        string userId,
        CancellationToken cancellationToken)
    {
        var results = await orders.ListForUserAsync(userId, cancellationToken);
        return [.. results.Select(ToDto)];
    }

    private static OrderDto ToDto(Order order) => new(
        order.Reference,
        order.Status.ToString().ToUpperInvariant(),
        order.Email,
        order.FullName,
        order.Phone,
        order.AddressLine,
        order.City,
        order.DeliveryZone,
        order.DeliveryZoneName,
        order.Notes,
        order.PaymentMethod == PaymentMethod.Hubtel ? "HUBTEL" : "ON_DELIVERY",
        // Only while there is still something to pay: a settled order must not
        // hand back a link that would start a second transaction.
        order.Status == OrderStatus.Pending ? order.PaymentCheckoutUrl : null,
        order.PaidAt is not null,
        // Orders placed before delivery was priced have a zero subtotal on the
        // row; show the total rather than a receipt that reads "GH₵0.00 goods".
        order.SubtotalMinor > 0 ? order.SubtotalMinor : order.TotalMinor,
        order.DiscountMinor,
        order.CouponCode,
        order.DiscountDescription,
        order.DeliveryFeeMinor,
        order.TotalMinor,
        order.Currency,
        order.CreatedAt,
        [.. order.Items.Select(item => new OrderLineDto(
            item.ProductId,
            item.Product?.Slug ?? string.Empty,
            item.Product?.Name ?? "Product",
            item.UnitPriceMinor,
            item.ListPriceMinor,
            item.Quantity,
            item.LineTotalMinor,
            item.DiscountMinor))]);
}
