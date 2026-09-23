namespace BodyBiotics.Domain.Entities;

/// <summary>How the money went back to the customer.</summary>
public enum RefundMethod
{
    MobileMoney = 0,
    Cash = 1,

    /// <summary>Reversed from Hubtel's merchant dashboard.</summary>
    Hubtel = 2,
    BankTransfer = 3,
}

/// <summary>
/// Money already returned to a customer. This is a record of a refund staff
/// have made, not an instruction to make one: nothing here moves money.
/// </summary>
public sealed class Refund
{
    public required string Id { get; init; }
    public required string OrderId { get; init; }
    public Order? Order { get; init; }

    public required int AmountMinor { get; init; }
    public required string Reason { get; init; }
    public RefundMethod Method { get; init; }

    /// <summary>The Mobile Money or bank transaction id, so the customer can find it.</summary>
    public string? Reference { get; init; }

    /// <summary>How many units this refund put back on sale, across every line.</summary>
    public int RestockedUnits { get; init; }

    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
}
