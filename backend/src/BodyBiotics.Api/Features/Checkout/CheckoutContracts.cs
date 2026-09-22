using FluentValidation;

namespace BodyBiotics.Api.Features.Checkout;

/// <summary>
/// Note what is absent: no prices and no totals. The client cannot influence
/// what an order costs; the server prices every line from the catalogue.
/// </summary>
public sealed record CheckoutRequest(
    string Email,
    string FullName,
    string Phone,
    string AddressLine,
    string City,
    string? Notes,
    /// <summary>
    /// Client-generated idempotency key. A checkout retried on a flaky mobile
    /// connection must not create a second order.
    /// </summary>
    string RequestId,
    /// <summary>
    /// Delivery area code. The client sends which area, never what it costs —
    /// the fee is looked up server-side like every other price.
    /// </summary>
    string? DeliveryZone = null,
    /// <summary>
    /// "ON_DELIVERY" or "HUBTEL". Defaults to pay on delivery, which is how the
    /// shop traded before online payment existed — an older client that does
    /// not send the field keeps working.
    /// </summary>
    string PaymentMethod = "ON_DELIVERY");

public sealed record OrderLineDto(
    string ProductId,
    string Slug,
    string Name,
    /// <summary>What was charged per unit — the sale price when there was one.</summary>
    int UnitPriceMinor,
    /// <summary>The shelf price at the time, when the item was on sale. Null otherwise.</summary>
    int? ListPriceMinor,
    int Quantity,
    int LineTotalMinor,
    /// <summary>This line's share of the basket discount.</summary>
    int DiscountMinor);

public sealed record OrderDto(
    string Reference,
    string Status,
    string Email,
    string FullName,
    string Phone,
    string AddressLine,
    string City,
    /// <summary>Delivery area code, empty on orders placed before zones existed.</summary>
    string DeliveryZone,
    /// <summary>The area's name as quoted, for the receipt.</summary>
    string DeliveryZoneName,
    string? Notes,
    string PaymentMethod,
    /// <summary>
    /// Where to send the customer to pay, when they chose online payment. Null
    /// for pay on delivery, and null once the order is settled.
    /// </summary>
    string? CheckoutUrl,
    bool IsPaid,
    /// <summary>The goods alone, before any discount.</summary>
    int SubtotalMinor,
    /// <summary>What the offers took off. Zero on an order that had none.</summary>
    int DiscountMinor,
    /// <summary>The code used, if any.</summary>
    string? CouponCode,
    /// <summary>What the discount was called, as it read on the day.</summary>
    string? DiscountDescription,
    /// <summary>Delivery as quoted; zero when the basket earned it free.</summary>
    int DeliveryFeeMinor,
    /// <summary>Goods minus discount plus delivery — what is collected.</summary>
    int TotalMinor,
    string Currency,
    DateTimeOffset CreatedAt,
    IReadOnlyList<OrderLineDto> Lines);

/// <summary>
/// A delivery area offered at checkout, and what it costs to reach. Sent to the
/// storefront so the customer sees the total before committing, never so the
/// client can decide it.
/// </summary>
public sealed record DeliveryZoneDto(
    string Code,
    string Name,
    int FeeMinor,
    string Estimate);

public sealed record DeliveryOptionsDto(
    IReadOnlyList<DeliveryZoneDto> Zones,
    int FreeDeliveryThresholdMinor,
    string Currency);

public sealed class CheckoutRequestValidator : AbstractValidator<CheckoutRequest>
{
    public CheckoutRequestValidator()
    {
        RuleFor(request => request.Email).NotEmpty().EmailAddress().MaximumLength(320);
        RuleFor(request => request.FullName).NotEmpty().MaximumLength(120);
        // Ghanaian numbers arrive as 024…, +23324… or with spaces; normalise
        // leniently here and let the delivery team deal with the rest.
        RuleFor(request => request.Phone)
            .NotEmpty()
            .MinimumLength(9)
            .MaximumLength(20)
            .Matches(@"^[0-9+\s()-]+$")
            .WithMessage("'Phone' may only contain digits, spaces and + ( ) -.")
            // Counted, not just matched: "+++ (((" satisfies the pattern above
            // and is not a number anyone can be called on.
            .Must(phone => phone is not null && phone.Count(char.IsAsciiDigit) is >= 9 and <= 15)
            .WithMessage("'Phone' must contain a real number we can call, e.g. 024 123 4567.");
        RuleFor(request => request.AddressLine).NotEmpty().MaximumLength(200);
        RuleFor(request => request.City).NotEmpty().MaximumLength(80);
        RuleFor(request => request.Notes).MaximumLength(500).When(r => r.Notes is not null);
        RuleFor(request => request.RequestId).NotEmpty().MaximumLength(64);
        // Optional so an older client still checks out; wrong is still rejected,
        // because silently re-pricing someone's delivery is worse than a 400.
        RuleFor(request => request.DeliveryZone)
            .Must(BodyBiotics.Domain.Common.DeliveryZones.IsKnown)
            .When(request => !string.IsNullOrWhiteSpace(request.DeliveryZone))
            .WithMessage("'Delivery Zone' is not an area we deliver to.");
        RuleFor(request => request.PaymentMethod)
            .Must(method => Enum.TryParse<BodyBiotics.Domain.Entities.PaymentMethod>(
                method?.Replace("_", string.Empty),
                ignoreCase: true,
                out _))
            .WithMessage("'Payment Method' must be ON_DELIVERY or HUBTEL.");
    }
}
