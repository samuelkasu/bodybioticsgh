using BodyBiotics.Domain.Common;
using BodyBiotics.Domain.Entities;

namespace BodyBiotics.Tests.Domain;

public class DeliveryAndRefundTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 23, 10, 0, 0, TimeSpan.Zero);

    private static Order NewOrder(PaymentMethod method = PaymentMethod.OnDelivery) => new()
    {
        Id = Identifier.New(),
        Reference = "BB-20260923-K7QX4M9T",
        Email = "customer@example.com",
        FullName = "Ama Mensah",
        Phone = "0241234567",
        AddressLine = "12 Oxford Street",
        City = "Accra",
        PaymentMethod = method,
        TotalMinor = 25_000,
    };

    private static Order PaidOrder()
    {
        var order = NewOrder(PaymentMethod.Hubtel);
        order.TryTransitionTo(OrderStatus.Paid);
        order.RecordPayment(25_000, Now);
        return order;
    }

    private static Delivery Trip(Order order) => new()
    {
        Id = Identifier.New(),
        OrderId = order.Id,
        RiderName = "Kofi Boateng",
        RiderPhone = "0241112222",
    };

    private static Refund RefundOf(Order order, int amountMinor) => new()
    {
        Id = Identifier.New(),
        OrderId = order.Id,
        AmountMinor = amountMinor,
        Reason = "Damaged",
    };

    [Fact]
    public void PayOnDeliveryGoesOutUnpaid()
    {
        var order = NewOrder();

        Assert.True(order.TryDispatch(Trip(order)));
        Assert.Equal(OrderStatus.Dispatched, order.Status);
    }

    [Fact]
    public void AnOnlineOrderWaitsForItsMoneyBeforeGoingOut()
    {
        var order = NewOrder(PaymentMethod.Hubtel);

        Assert.False(order.TryDispatch(Trip(order)));
        Assert.Empty(order.Deliveries);
    }

    [Fact]
    public void OnlyOneTripIsOnTheRoadAtATime()
    {
        var order = NewOrder();
        order.TryDispatch(Trip(order));

        Assert.False(order.TryDispatch(Trip(order)));
        Assert.Single(order.Deliveries);
    }

    [Fact]
    public void DeliveringAPayOnDeliveryOrderIsAlsoItsPayment()
    {
        var order = NewOrder();
        order.TryDispatch(Trip(order));

        Assert.True(order.TryCompleteDelivery(Now, 25_000, "cash"));

        Assert.Equal(OrderStatus.Fulfilled, order.Status);
        Assert.Equal(25_000, order.AmountPaidMinor);
        Assert.Equal(Now, order.PaidAt);
        var trip = Assert.Single(order.Deliveries);
        Assert.Equal(DeliveryStatus.Delivered, trip.Status);
        Assert.Equal("cash", trip.CollectedVia);
    }

    [Fact]
    public void APayOnDeliveryOrderCannotBeDeliveredWithoutTheMoney()
    {
        var order = NewOrder();
        order.TryDispatch(Trip(order));

        Assert.False(order.TryCompleteDelivery(Now, null, null));
        Assert.Equal(OrderStatus.Dispatched, order.Status);
        Assert.Null(order.PaidAt);
    }

    [Fact]
    public void AFailedTripGoesBackToWhereItCameFromAndIsKept()
    {
        var unpaid = NewOrder();
        unpaid.TryDispatch(Trip(unpaid));
        Assert.True(unpaid.TryFailDelivery("Nobody home", Now));
        Assert.Equal(OrderStatus.Pending, unpaid.Status);

        var paid = PaidOrder();
        paid.TryDispatch(Trip(paid));
        Assert.True(paid.TryFailDelivery("Wrong address", Now));
        Assert.Equal(OrderStatus.Paid, paid.Status);

        // And out again, with both trips on record.
        Assert.True(paid.TryDispatch(Trip(paid)));
        Assert.Equal(2, paid.Deliveries.Count);
        Assert.Equal("Wrong address", paid.Deliveries.First().FailureReason);
    }

    [Fact]
    public void APartialRefundLeavesTheStatusAlone()
    {
        var order = PaidOrder();

        Assert.True(order.TryAddRefund(RefundOf(order, 5_000)));

        Assert.Equal(OrderStatus.Paid, order.Status);
        Assert.Equal(20_000, order.RefundableMinor);
    }

    [Fact]
    public void RefundingTheRestMarksTheOrderRefunded()
    {
        var order = PaidOrder();
        order.TryAddRefund(RefundOf(order, 5_000));

        Assert.True(order.TryAddRefund(RefundOf(order, 20_000)));

        Assert.Equal(OrderStatus.Refunded, order.Status);
        Assert.Equal(0, order.RefundableMinor);
    }

    [Fact]
    public void NeverRefundsMoreThanWasPaid()
    {
        var order = PaidOrder();

        Assert.False(order.TryAddRefund(RefundOf(order, 25_001)));
        Assert.Empty(order.Refunds);
        Assert.Equal(0, order.RefundedMinor);
    }

    [Fact]
    public void AnUnpaidOrderHasNothingToRefund()
    {
        var order = NewOrder();

        Assert.False(order.TryAddRefund(RefundOf(order, 1)));
    }

    [Fact]
    public void ALineCannotBeRestockedPastWhatWasOrdered()
    {
        var item = new OrderItem
        {
            Id = Identifier.New(),
            OrderId = "order",
            ProductId = "p",
            UnitPriceMinor = 12_500,
            Quantity = 2,
        };

        Assert.True(item.TryRestock(1));
        Assert.False(item.TryRestock(2));
        Assert.True(item.TryRestock(1));
        Assert.Equal(2, item.RestockedQuantity);
    }
}
