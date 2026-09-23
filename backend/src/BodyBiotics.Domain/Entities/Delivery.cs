namespace BodyBiotics.Domain.Entities;

/// <summary>Who is carrying the order. Everything is local — there is no shipping.</summary>
public enum DeliveryMethod
{
    /// <summary>The shop's own rider or driver, on a motorbike or in a car.</summary>
    Rider = 0,

    /// <summary>A delivery service or app — Yango, Bolt, a courier company — named in CourierName.</summary>
    Courier = 1,
}

public enum DeliveryStatus
{
    OutForDelivery = 0,
    Delivered = 1,
    Failed = 2,
}

/// <summary>
/// One trip with an order. An order can have several — the customer was not
/// in, the rider tries again tomorrow — and each is kept, so a dispute about
/// who had the goods when can be answered.
/// </summary>
public sealed class Delivery
{
    public required string Id { get; init; }
    public required string OrderId { get; init; }
    public Order? Order { get; init; }

    public DeliveryMethod Method { get; init; }

    /// <summary>The service used when <see cref="Method"/> is Courier.</summary>
    public string? CourierName { get; init; }

    /// <summary>Who the customer should expect at the door, and who staff ring to chase it.</summary>
    public required string RiderName { get; init; }
    public required string RiderPhone { get; init; }

    /// <summary>Anything staff want on record — a trip link, a plate number.</summary>
    public string? Notes { get; init; }

    public DeliveryStatus Status { get; set; } = DeliveryStatus.OutForDelivery;

    public DateTimeOffset DispatchedAt { get; init; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? DeliveredAt { get; set; }
    public DateTimeOffset? FailedAt { get; set; }
    public string? FailureReason { get; set; }

    /// <summary>What the rider took at the door on a pay-on-delivery order.</summary>
    public int? CollectedMinor { get; set; }

    /// <summary>"cash" or "mobilemoney".</summary>
    public string? CollectedVia { get; set; }
}
