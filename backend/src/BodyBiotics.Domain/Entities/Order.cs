namespace BodyBiotics.Domain.Entities;

public enum OrderStatus
{
    Pending = 0,
    Paid = 1,
    Fulfilled = 2,
    Cancelled = 3,
    Refunded = 4,
}

/// <summary>
/// How the customer is paying. Stored as text, like every other enum here, so
/// reordering cannot silently reclassify existing orders.
/// </summary>
public enum PaymentMethod
{
    /// <summary>Cash or Mobile Money handed over when the order arrives.</summary>
    OnDelivery = 0,

    /// <summary>Paid up front through Hubtel's hosted checkout.</summary>
    Hubtel = 1,
}

public sealed class Order
{
    public required string Id { get; init; }

    /// <summary>Human-facing reference shown on receipts and Mobile Money confirmations.</summary>
    public required string Reference { get; init; }

    public string? UserId { get; set; }
    public User? User { get; set; }
    public required string Email { get; set; }

    /// <summary>
    /// Where this order goes and who to call about it. Copied at checkout rather
    /// than read from the customer's account: an account's address changes, and
    /// a delivery already made must still show where it went.
    /// </summary>
    public required string FullName { get; set; }

    /// <summary>The number the shop rings to confirm before delivering.</summary>
    public required string Phone { get; set; }

    public required string AddressLine { get; set; }
    public required string City { get; set; }

    /// <summary>
    /// Delivery area code from <see cref="Common.DeliveryZones"/>. Empty on
    /// orders placed before delivery was priced up front.
    /// </summary>
    public string DeliveryZone { get; set; } = string.Empty;

    /// <summary>
    /// The area's name as it was when the order was placed. Copied for the same
    /// reason line prices are: the zone table is edited, receipts are not.
    /// </summary>
    public string DeliveryZoneName { get; set; } = string.Empty;

    /// <summary>Landmarks, gate codes, preferred delivery time.</summary>
    public string? Notes { get; set; }

    public PaymentMethod PaymentMethod { get; set; } = PaymentMethod.OnDelivery;

    /// <summary>
    /// Hubtel's `CheckoutId` for this order. Kept so a callback can be matched
    /// back even if the client reference is ever reused, and so support can
    /// find the transaction in Hubtel's dashboard.
    /// </summary>
    public string? PaymentReference { get; set; }

    /// <summary>
    /// The hosted checkout URL Hubtel issued. Stored rather than regenerated:
    /// a customer who retries the same checkout must land on the invoice that
    /// already exists, not create a second one.
    /// </summary>
    public string? PaymentCheckoutUrl { get; set; }

    /// <summary>Which rail the money actually came over — "mobilemoney", "card".</summary>
    public string? PaymentChannel { get; set; }

    public DateTimeOffset? PaidAt { get; set; }

    public OrderStatus Status { get; private set; } = OrderStatus.Pending;

    /// <summary>The goods, before delivery and before any discount.</summary>
    public int SubtotalMinor { get; set; }

    /// <summary>
    /// What the campaigns and the coupon took off the goods. Held as its own
    /// figure rather than baked into the subtotal so the receipt can show the
    /// saving — a customer who used a code wants to see it worked.
    /// </summary>
    public int DiscountMinor { get; set; }

    /// <summary>The code that was used, upper-case. Null when none was.</summary>
    public string? CouponCode { get; set; }

    /// <summary>
    /// What to call the discount on the receipt, as it read when the order was
    /// placed. Copied for the same reason the delivery zone's name is: the
    /// campaign will be edited, the receipt must not change.
    /// </summary>
    public string? DiscountDescription { get; set; }

    /// <summary>
    /// What delivery was quoted at, zero when the basket earned it free. Held
    /// separately from <see cref="TotalMinor"/> so a customer disputing a charge
    /// can be shown the same breakdown they agreed to.
    /// </summary>
    public int DeliveryFeeMinor { get; set; }

    /// <summary>Goods plus delivery: the figure that is charged or collected.</summary>
    public int TotalMinor { get; set; }

    public string Currency { get; set; } = "GHS";

    /// <summary>
    /// Idempotency key supplied by the client. A checkout retried over a flaky
    /// mobile connection must not create a second order.
    /// </summary>
    public string? RequestId { get; init; }

    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<OrderItem> Items { get; init; } = [];

    /// <summary>
    /// Payment webhooks arrive out of order and more than once, so the
    /// transitions are explicit rather than a free setter on Status.
    /// </summary>
    public bool TryTransitionTo(OrderStatus next)
    {
        var allowed = Status switch
        {
            OrderStatus.Pending => next is OrderStatus.Paid or OrderStatus.Cancelled,
            OrderStatus.Paid => next is OrderStatus.Fulfilled or OrderStatus.Refunded,
            OrderStatus.Fulfilled => next is OrderStatus.Refunded,
            _ => false,
        };

        // Re-delivered webhook for a transition already applied: not an error.
        if (next == Status)
        {
            return true;
        }

        if (!allowed)
        {
            return false;
        }

        Status = next;
        UpdatedAt = DateTimeOffset.UtcNow;
        return true;
    }
}

public sealed class OrderItem
{
    public required string Id { get; init; }
    public required string OrderId { get; init; }
    public Order? Order { get; init; }

    public required string ProductId { get; init; }
    public Product? Product { get; init; }

    /// <summary>
    /// What was charged per unit, copied at purchase time: product prices
    /// change, receipts must not. A product sold during a sale stores the sale
    /// price here and its shelf price in <see cref="ListPriceMinor"/>.
    /// </summary>
    public required int UnitPriceMinor { get; init; }

    /// <summary>
    /// The shelf price at the time, when it was higher than what was charged.
    /// Null when the item was not on sale.
    /// </summary>
    public int? ListPriceMinor { get; init; }

    public required int Quantity { get; init; }

    /// <summary>
    /// This line's share of the order's basket discount. Apportioned at
    /// checkout so a partial refund does not have to guess how much of a
    /// "GH₵50 off" applied to the item being sent back.
    /// </summary>
    public int DiscountMinor { get; set; }

    public int LineTotalMinor => UnitPriceMinor * Quantity;

    /// <summary>What this line actually contributed to the total.</summary>
    public int DiscountedLineTotalMinor => Math.Max(0, LineTotalMinor - DiscountMinor);
}
