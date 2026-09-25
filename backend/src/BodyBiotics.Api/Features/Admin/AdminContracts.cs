using FluentValidation;

namespace BodyBiotics.Api.Features.Admin;

/// <summary>
/// One row in the orders queue. Carries the delivery details, because the first
/// thing staff do with a new order is ring the number on it.
/// </summary>
public sealed record AdminOrderDto(
    string Reference,
    string Status,
    string Email,
    string FullName,
    string Phone,
    string AddressLine,
    string City,
    /// <summary>Which delivery run this order belongs on.</summary>
    string DeliveryZoneName,
    string? Notes,
    int SubtotalMinor,
    /// <summary>What the offers took off the goods. Zero when none applied.</summary>
    int DiscountMinor,
    /// <summary>The code used, so staff can see why a total is lower than the lines.</summary>
    string? CouponCode,
    string? DiscountDescription,
    /// <summary>What the rider collects on top of the goods, zero when it was free.</summary>
    int DeliveryFeeMinor,
    int TotalMinor,
    string Currency,
    int ItemCount,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    IReadOnlyList<AdminOrderLineDto> Lines,
    /// <summary>"ON_DELIVERY" or "HUBTEL": whether the rider collects money.</summary>
    string PaymentMethod,
    DateTimeOffset? PaidAt,
    /// <summary>What was actually received — the ceiling on refunds.</summary>
    int AmountPaidMinor,
    int RefundedMinor,
    int RefundableMinor,
    IReadOnlyList<AdminDeliveryDto> Deliveries,
    IReadOnlyList<AdminRefundDto> Refunds);

public sealed record AdminOrderLineDto(
    string ProductId,
    string Slug,
    string Name,
    int UnitPriceMinor,
    int Quantity,
    int LineTotalMinor,
    /// <summary>This line's share of the discount, for working out a partial refund.</summary>
    int DiscountMinor,
    /// <summary>Units refunds have already put back on sale; the rest can still go back.</summary>
    int RestockedQuantity);

public sealed record AdminDeliveryDto(
    string Id,
    string Method,
    string? CourierName,
    string RiderName,
    string RiderPhone,
    string? Notes,
    string Status,
    DateTimeOffset DispatchedAt,
    DateTimeOffset? DeliveredAt,
    DateTimeOffset? FailedAt,
    string? FailureReason,
    int? CollectedMinor,
    string? CollectedVia);

public sealed record AdminRefundDto(
    string Id,
    int AmountMinor,
    string Method,
    string Reason,
    string? Reference,
    int RestockedUnits,
    DateTimeOffset CreatedAt);

/// <summary>Sends an order out. Method is "RIDER" (the shop's own) or "COURIER" (a service, named).</summary>
public sealed record DispatchOrderRequest(
    string Method,
    string RiderName,
    string RiderPhone,
    string? CourierName = null,
    string? Notes = null);

/// <summary>
/// Closes the trip as delivered. The collected fields are required only for a
/// pay-on-delivery order, where handing over the goods is also the payment.
/// </summary>
public sealed record CompleteDeliveryRequest(
    int? CollectedMinor = null,
    /// <summary>"cash" or "mobilemoney".</summary>
    string? CollectedVia = null);

public sealed record FailDeliveryRequest(string Reason);

/// <summary>
/// Records money staff have already returned. Nothing here sends it — the
/// method and reference say where it went, so the customer can find it.
/// </summary>
public sealed record RecordRefundRequest(
    int AmountMinor,
    /// <summary>"MOBILE_MONEY", "CASH", "HUBTEL" or "BANK_TRANSFER".</summary>
    string Method,
    string Reason,
    string? Reference = null,
    /// <summary>Units to put back on sale, per product. Empty when nothing came back.</summary>
    IReadOnlyList<RestockLine>? Restock = null);

public sealed record RestockLine(string ProductId, int Quantity);

public sealed class DispatchOrderRequestValidator : AbstractValidator<DispatchOrderRequest>
{
    public DispatchOrderRequestValidator()
    {
        RuleFor(request => request.Method)
            .Must(method => AdminService.TryParseDeliveryMethod(method, out _))
            .WithMessage("Method must be RIDER or COURIER.");
        RuleFor(request => request.RiderName).NotEmpty().MaximumLength(120);
        // Lengths match the checkout's own phone rule: the customer is told
        // this number and will ring it.
        RuleFor(request => request.RiderPhone).NotEmpty().MinimumLength(9).MaximumLength(20);
        RuleFor(request => request.CourierName)
            .NotEmpty()
            .When(request => AdminService.TryParseDeliveryMethod(request.Method, out var method)
                && method == BodyBiotics.Domain.Entities.DeliveryMethod.Courier)
            .WithMessage("Name the delivery service — Yango, Bolt, or the company used.");
        RuleFor(request => request.CourierName).MaximumLength(80);
        RuleFor(request => request.Notes).MaximumLength(500);
    }
}

public sealed class CompleteDeliveryRequestValidator : AbstractValidator<CompleteDeliveryRequest>
{
    public CompleteDeliveryRequestValidator()
    {
        RuleFor(request => request.CollectedMinor!.Value)
            .GreaterThan(0)
            .When(request => request.CollectedMinor.HasValue);
        RuleFor(request => request.CollectedVia)
            .Must(via => via is "cash" or "mobilemoney")
            .When(request => request.CollectedMinor.HasValue)
            .WithMessage("Say how the rider was paid: cash or mobilemoney.");
    }
}

public sealed class FailDeliveryRequestValidator : AbstractValidator<FailDeliveryRequest>
{
    public FailDeliveryRequestValidator()
    {
        RuleFor(request => request.Reason).NotEmpty().MaximumLength(500);
    }
}

public sealed class RecordRefundRequestValidator : AbstractValidator<RecordRefundRequest>
{
    public RecordRefundRequestValidator()
    {
        RuleFor(request => request.AmountMinor).GreaterThan(0);
        RuleFor(request => request.Method)
            .Must(method => AdminService.TryParseRefundMethod(method, out _))
            .WithMessage("Method must be MOBILE_MONEY, CASH, HUBTEL or BANK_TRANSFER.");
        RuleFor(request => request.Reason).NotEmpty().MaximumLength(500);
        RuleFor(request => request.Reference).MaximumLength(64);
        RuleForEach(request => request.Restock).ChildRules(line =>
        {
            line.RuleFor(item => item.ProductId).NotEmpty();
            line.RuleFor(item => item.Quantity).GreaterThan(0);
        });
        RuleFor(request => request.Restock)
            .Must(lines => lines is null || lines.Select(line => line.ProductId).Distinct().Count() == lines.Count)
            .WithMessage("List each product once in restock.");
    }
}

/// <summary>
/// The catalogue as staff need it. Separate from the storefront's ProductDto on
/// purpose: that one exposes only `inStock`, because a public endpoint showing
/// exact inventory hands a competitor the shop's sales figures. Stock levels
/// live here, behind the admin policy.
/// </summary>
public sealed record AdminProductDto(
    string Id,
    string Slug,
    string Name,
    /// <summary>The shelf price. Staff edit this one; a sale is the fields below.</summary>
    int PriceMinor,
    int? SalePriceMinor,
    DateTimeOffset? SaleStartsAt,
    DateTimeOffset? SaleEndsAt,
    /// <summary>Whether the sale is running at this moment, as the shop sees it.</summary>
    bool OnSale,
    string Currency,
    int Stock,
    bool Active,
    string ImageUrl,
    string? CategoryName,
    string? BrandName)
{
    public static AdminProductDto From(BodyBiotics.Domain.Entities.Product product) => new(
        product.Id,
        product.Slug,
        product.Name,
        product.PriceMinor,
        product.SalePriceMinor,
        product.SaleStartsAt,
        product.SaleEndsAt,
        product.IsOnSale(DateTimeOffset.UtcNow),
        product.Currency,
        product.Stock,
        product.Active,
        product.ImageUrl,
        product.Category?.Name,
        product.Brand?.Name);
}

public sealed record UpdateOrderStatusRequest(string Status);

/// <summary>
/// Every field optional: staff usually change one thing, and requiring the
/// whole product back means a stale form can silently revert a price someone
/// else just corrected.
/// </summary>
public sealed record UpdateProductRequest(
    int? PriceMinor,
    int? Stock,
    bool? Active,
    /// <summary>What to charge while the sale runs. Below PriceMinor, or it is not a sale.</summary>
    int? SalePriceMinor,
    DateTimeOffset? SaleStartsAt,
    DateTimeOffset? SaleEndsAt,
    /// <summary>
    /// Ends the sale and forgets its dates. A separate flag because a JSON
    /// field that is absent and one that is null arrive here identically, and
    /// "leave the sale alone" must not read as "delete it".
    /// </summary>
    bool? ClearSale = null,
    /// <summary>
    /// The stock the form was showing when it was loaded. Required with Stock:
    /// orders keep taking stock while the form sits open, and saving the number
    /// someone saw ten minutes ago would quietly hand those units back.
    /// </summary>
    int? ExpectedStock = null);

public sealed class UpdateOrderStatusRequestValidator
    : AbstractValidator<UpdateOrderStatusRequest>
{
    public UpdateOrderStatusRequestValidator()
    {
        RuleFor(request => request.Status).NotEmpty().MaximumLength(16);
    }
}

public sealed class UpdateProductRequestValidator : AbstractValidator<UpdateProductRequest>
{
    public UpdateProductRequestValidator()
    {
        // Mirrors the check constraints on the table: a negative price or stock
        // is rejected here with a readable message rather than as a 500 from
        // Postgres.
        RuleFor(request => request.PriceMinor!.Value)
            .GreaterThanOrEqualTo(0)
            .When(request => request.PriceMinor.HasValue);

        RuleFor(request => request.Stock!.Value)
            .GreaterThanOrEqualTo(0)
            .When(request => request.Stock.HasValue);

        RuleFor(request => request.ExpectedStock)
            .NotNull()
            .When(request => request.Stock.HasValue)
            .WithMessage("Send expectedStock, the stock the form was showing, with any stock change.");

        RuleFor(request => request.SalePriceMinor!.Value)
            .GreaterThanOrEqualTo(0)
            .When(request => request.SalePriceMinor.HasValue);

        // A "sale" at or above the shelf price is a mispriced product with a
        // badge on it. Rejected here rather than silently ignored by
        // Product.IsOnSale, so whoever typed it finds out.
        RuleFor(request => request)
            .Must(request => request.SalePriceMinor!.Value < request.PriceMinor!.Value)
            .When(request => request.SalePriceMinor.HasValue && request.PriceMinor.HasValue)
            .WithMessage("'Sale Price' must be below the normal price.");

        RuleFor(request => request)
            .Must(request => request.SaleEndsAt!.Value > request.SaleStartsAt!.Value)
            .When(request => request.SaleStartsAt.HasValue && request.SaleEndsAt.HasValue)
            .WithMessage("A sale cannot end before it starts.");

        RuleFor(request => request)
            .Must(request =>
                request.PriceMinor.HasValue
                || request.Stock.HasValue
                || request.Active.HasValue
                || request.SalePriceMinor.HasValue
                || request.SaleStartsAt.HasValue
                || request.SaleEndsAt.HasValue
                || request.ClearSale == true)
            .WithMessage(
                "Send at least one of priceMinor, stock, active, salePriceMinor, " +
                "saleStartsAt, saleEndsAt or clearSale.");
    }
}
