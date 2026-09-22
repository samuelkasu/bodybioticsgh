using BodyBiotics.Domain.Common;
using BodyBiotics.Domain.Entities;

namespace BodyBiotics.Tests.Domain;

public class OrderTests
{
    private static Order NewOrder() => new()
    {
        Id = Identifier.New(),
        Reference = "BB-20260101-K7QX4M9T",
        Email = "customer@example.com",
        FullName = "Ama Mensah",
        Phone = "0241234567",
        AddressLine = "12 Oxford Street",
        City = "Accra",
    };

    [Fact]
    public void NewOrderStartsPending()
    {
        Assert.Equal(OrderStatus.Pending, NewOrder().Status);
    }

    [Fact]
    public void PendingCanBePaid()
    {
        var order = NewOrder();

        Assert.True(order.TryTransitionTo(OrderStatus.Paid));
        Assert.Equal(OrderStatus.Paid, order.Status);
    }

    [Fact]
    public void RedeliveredWebhookForTheSameStatusIsAccepted()
    {
        var order = NewOrder();
        order.TryTransitionTo(OrderStatus.Paid);

        // Payment providers retry; a duplicate must not be reported as failure.
        Assert.True(order.TryTransitionTo(OrderStatus.Paid));
        Assert.Equal(OrderStatus.Paid, order.Status);
    }

    [Fact]
    public void PaidCannotGoBackToPending()
    {
        var order = NewOrder();
        order.TryTransitionTo(OrderStatus.Paid);

        Assert.False(order.TryTransitionTo(OrderStatus.Pending));
        Assert.Equal(OrderStatus.Paid, order.Status);
    }

    [Fact]
    public void CancelledIsTerminal()
    {
        var order = NewOrder();
        order.TryTransitionTo(OrderStatus.Cancelled);

        Assert.False(order.TryTransitionTo(OrderStatus.Paid));
        Assert.False(order.TryTransitionTo(OrderStatus.Fulfilled));
        Assert.Equal(OrderStatus.Cancelled, order.Status);
    }

    [Fact]
    public void PendingCannotBeFulfilledWithoutPayment()
    {
        var order = NewOrder();

        Assert.False(order.TryTransitionTo(OrderStatus.Fulfilled));
    }

    [Fact]
    public void LineTotalsMultiplyStoredUnitPrice()
    {
        var item = new OrderItem
        {
            Id = Identifier.New(),
            OrderId = "order",
            ProductId = "product",
            UnitPriceMinor = 12_500,
            Quantity = 3,
        };

        Assert.Equal(37_500, item.LineTotalMinor);
    }
}
