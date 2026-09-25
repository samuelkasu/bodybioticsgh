using BodyBiotics.Api.Features.Payments;
using BodyBiotics.Api.Http;
using BodyBiotics.Domain.Abstractions;
using BodyBiotics.Domain.Common;
using BodyBiotics.Domain.Entities;
using BodyBiotics.Tests.Fakes;
using Microsoft.Extensions.Logging.Abstractions;

namespace BodyBiotics.Tests.Api;

public class PaymentServiceTests
{
    private const string Reference = "BB-20260917-K7QX4M9T";

    private static Product Product(int stock) => new()
    {
        Id = "a",
        Slug = "a",
        Name = "Glow Serum",
        Description = string.Empty,
        PriceMinor = 12_500,
        Stock = stock,
        Active = true,
        ImageUrl = "/catalog/a/main.webp",
    };

    private static Order Order(Product product, PaymentMethod method, int quantity = 2) => new()
    {
        Id = Identifier.New(),
        Reference = Reference,
        Email = "ama@example.com",
        FullName = "Ama Mensah",
        Phone = "0241234567",
        AddressLine = "12 Oxford Street",
        City = "Accra",
        PaymentMethod = method,
        TotalMinor = product.PriceMinor * quantity,
        Items =
        [
            new OrderItem
            {
                Id = Identifier.New(),
                OrderId = "order",
                ProductId = product.Id,
                Product = product,
                UnitPriceMinor = product.PriceMinor,
                Quantity = quantity,
            },
        ],
    };

    private static (PaymentService Service, FakeAdminRepository Orders, FakePaymentGateway Gateway, Order Order, Product Product)
        Build(PaymentMethod method = PaymentMethod.Hubtel, int stock = 8)
    {
        var product = Product(stock);
        var order = Order(product, method);
        var repository = new FakeAdminRepository(product);
        repository.Orders.Add(order);

        var gateway = new FakePaymentGateway();
        var service = new PaymentService(repository, new FakeUnitOfWork(), gateway, new TestMail().Notifier, NullLogger<PaymentService>.Instance);

        return (service, repository, gateway, order, product);
    }

    [Fact]
    public async Task MarksTheOrderPaidWhenTheProviderConfirmsIt()
    {
        var (service, _, gateway, order, _) = Build();
        gateway.NextStatus = new PaymentStatus(PaymentState.Paid, 25_000, "txn-1", "mobilemoney");

        var status = await service.ReconcileAsync(Reference, default);

        Assert.Equal(OrderStatus.Paid, status);
        Assert.NotNull(order.PaidAt);
        Assert.Equal("mobilemoney", order.PaymentChannel);
        Assert.Equal("txn-1", order.PaymentReference);
    }

    [Fact]
    public async Task RefusesToSettleWhenTheAmountDoesNotMatch()
    {
        var (service, _, gateway, order, _) = Build();
        // Paid, but for less than the order is worth.
        gateway.NextStatus = new PaymentStatus(PaymentState.Paid, 100, "txn-1", "mobilemoney");

        var status = await service.ReconcileAsync(Reference, default);

        Assert.Equal(OrderStatus.Pending, status);
        Assert.Null(order.PaidAt);
    }

    [Fact]
    public async Task SettlingTwiceDoesNotMoveTheOrderAgain()
    {
        var (service, repository, gateway, order, _) = Build();
        gateway.NextStatus = new PaymentStatus(PaymentState.Paid, 25_000, "txn-1", "mobilemoney");

        await service.ReconcileAsync(Reference, default);
        var paidAt = order.PaidAt;
        var saves = repository.SaveCount;

        // Hubtel retries callbacks, and the order page reconciles as well.
        await service.ReconcileAsync(Reference, default);

        Assert.Equal(OrderStatus.Paid, order.Status);
        Assert.Equal(paidAt, order.PaidAt);
        Assert.Equal(saves, repository.SaveCount);
    }

    [Fact]
    public async Task AFailedPaymentCancelsTheOrderAndReturnsTheStock()
    {
        var (service, _, gateway, order, product) = Build(stock: 8);
        gateway.NextStatus = new PaymentStatus(PaymentState.Failed, 0, null, null);

        var status = await service.ReconcileAsync(Reference, default);

        Assert.Equal(OrderStatus.Cancelled, status);
        // Checkout took two units when the order was placed.
        Assert.Equal(10, product.Stock);
    }

    [Fact]
    public async Task APendingPaymentLeavesTheOrderAlone()
    {
        var (service, _, gateway, order, product) = Build(stock: 8);
        gateway.NextStatus = new PaymentStatus(PaymentState.Pending, 0, null, null);

        var status = await service.ReconcileAsync(Reference, default);

        // The customer may still be on Hubtel's page. Cancelling here would
        // take the order away mid-payment.
        Assert.Equal(OrderStatus.Pending, status);
        Assert.Equal(8, product.Stock);
    }

    [Fact]
    public async Task AReferenceTheProviderDoesNotRecogniseChangesNothing()
    {
        var (service, _, gateway, _, product) = Build(stock: 8);
        gateway.NextStatus = new PaymentStatus(PaymentState.Unknown, 0, null, null);

        var status = await service.ReconcileAsync(Reference, default);

        Assert.Equal(OrderStatus.Pending, status);
        Assert.Equal(8, product.Stock);
    }

    [Fact]
    public async Task APayOnDeliveryOrderIsNeverAskedAbout()
    {
        var (service, _, gateway, _, _) = Build(PaymentMethod.OnDelivery);
        gateway.NextStatus = new PaymentStatus(PaymentState.Paid, 25_000, "txn-1", "card");

        var status = await service.ReconcileAsync(Reference, default);

        // Nothing was charged online, so nothing the provider says applies.
        Assert.Equal(OrderStatus.Pending, status);
    }

    [Fact]
    public async Task AnUnknownReferenceIsRejected()
    {
        var (service, _, _, _, _) = Build();

        // What a forged or misdirected callback looks like.
        await Assert.ThrowsAsync<ApiException>(() =>
            service.ReconcileAsync("BB-20260917-NOTREAL0", default));
    }
}
