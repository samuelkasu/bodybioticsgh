using BodyBiotics.Api.Features.Admin;
using BodyBiotics.Api.Features.Promotions;
using BodyBiotics.Api.Http;
using BodyBiotics.Domain.Common;
using BodyBiotics.Domain.Entities;
using BodyBiotics.Tests.Fakes;

namespace BodyBiotics.Tests.Api;

public class DeliveryAndRefundServiceTests
{
    private const string Reference = "BB-20260923-K7QX4M9T";

    private static Product Product(int stock = 8) => new()
    {
        Id = "a",
        Slug = "glow-serum",
        Name = "Glow Serum",
        Description = string.Empty,
        PriceMinor = 12_500,
        Stock = stock,
        Active = true,
        ImageUrl = "/catalog/a/main.webp",
    };

    private static Order Order(Product product, PaymentMethod method = PaymentMethod.OnDelivery) => new()
    {
        Id = Identifier.New(),
        Reference = Reference,
        Email = "customer@example.com",
        FullName = "Ama Mensah",
        Phone = "0241234567",
        AddressLine = "12 Oxford Street",
        City = "Accra",
        PaymentMethod = method,
        TotalMinor = 25_000,
        Items =
        [
            new OrderItem
            {
                Id = Identifier.New(),
                OrderId = "order",
                ProductId = product.Id,
                Product = product,
                UnitPriceMinor = product.PriceMinor,
                Quantity = 2,
            },
        ],
    };

    private static (AdminService Service, Order Order, Product Product, TestMail Mail) Build(
        PaymentMethod method = PaymentMethod.OnDelivery)
    {
        var product = Product();
        var order = Order(product, method);
        var repository = new FakeAdminRepository(product);
        repository.Orders.Add(order);
        var mail = new TestMail();

        var service = new AdminService(
            repository,
            mail.Notifier,
            new PricingService(new FakePromotionRepository()),
            new UpdateOrderStatusRequestValidator(),
            new UpdateProductRequestValidator(),
            new DispatchOrderRequestValidator(),
            new CompleteDeliveryRequestValidator(),
            new FailDeliveryRequestValidator(),
            new RecordRefundRequestValidator());

        return (service, order, product, mail);
    }

    private static readonly DispatchOrderRequest Rider = new("RIDER", "Kofi Boateng", "0241112222");

    [Fact]
    public async Task APayOnDeliveryOrderIsDispatchedThenDeliveredAndPaidInOneStep()
    {
        var (service, order, _, _) = Build();

        var dispatched = await service.DispatchAsync(Reference, Rider, default);
        Assert.Equal("DISPATCHED", dispatched.Status);
        Assert.Equal("OUT_FOR_DELIVERY", Assert.Single(dispatched.Deliveries).Status);

        var delivered = await service.CompleteDeliveryAsync(
            Reference,
            new CompleteDeliveryRequest(25_000, "mobilemoney"),
            default);

        Assert.Equal("FULFILLED", delivered.Status);
        Assert.Equal(25_000, delivered.AmountPaidMinor);
        Assert.NotNull(order.PaidAt);
        Assert.Equal("mobilemoney", order.PaymentChannel);
    }

    [Fact]
    public async Task ACourierTripMustNameTheService()
    {
        var (service, order, _, _) = Build();

        await Assert.ThrowsAsync<FluentValidation.ValidationException>(() =>
            service.DispatchAsync(Reference, new DispatchOrderRequest("COURIER", "Driver", "0241112222"), default));

        await service.DispatchAsync(
            Reference,
            new DispatchOrderRequest("COURIER", "Driver", "0241112222", CourierName: "Yango"),
            default);

        Assert.Equal("Yango", Assert.Single(order.Deliveries).CourierName);
    }

    [Fact]
    public async Task AnUnpaidOnlineOrderDoesNotGoOut()
    {
        var (service, order, _, _) = Build(PaymentMethod.Hubtel);

        var refused = await Assert.ThrowsAsync<ApiException>(() =>
            service.DispatchAsync(Reference, Rider, default));

        Assert.Equal(ApiErrorCode.Conflict, refused.Code);
        Assert.Empty(order.Deliveries);
    }

    [Fact]
    public async Task DeliveringPayOnDeliveryNeedsWhatWasCollectedAndNoMoreThanTheTotal()
    {
        var (service, order, _, _) = Build();
        await service.DispatchAsync(Reference, Rider, default);

        await Assert.ThrowsAsync<ApiException>(() =>
            service.CompleteDeliveryAsync(Reference, new CompleteDeliveryRequest(), default));
        await Assert.ThrowsAsync<ApiException>(() =>
            service.CompleteDeliveryAsync(Reference, new CompleteDeliveryRequest(25_001, "cash"), default));

        Assert.Equal(OrderStatus.Dispatched, order.Status);
        Assert.Null(order.PaidAt);
    }

    [Fact]
    public async Task AFailedTripCanBeSentAgain()
    {
        var (service, order, _, _) = Build();
        await service.DispatchAsync(Reference, Rider, default);

        var back = await service.FailDeliveryAsync(Reference, new FailDeliveryRequest("Nobody home"), default);
        Assert.Equal("PENDING", back.Status);

        await service.DispatchAsync(Reference, Rider, default);
        Assert.Equal(2, order.Deliveries.Count);
    }

    [Fact]
    public async Task TheBareStatusEndpointCannotSkipTheDetails()
    {
        var (service, _, _, _) = Build();

        foreach (var status in new[] { "dispatched", "fulfilled", "refunded" })
        {
            var refused = await Assert.ThrowsAsync<ApiException>(() =>
                service.UpdateOrderStatusAsync(Reference, new UpdateOrderStatusRequest(status), default));
            Assert.Equal(ApiErrorCode.BadRequest, refused.Code);
        }
    }

    [Fact]
    public async Task MarkingPaidByHandRecordsTheTotal()
    {
        var (service, order, _, _) = Build();

        await service.UpdateOrderStatusAsync(Reference, new UpdateOrderStatusRequest("paid"), default);

        Assert.Equal(25_000, order.AmountPaidMinor);
    }

    [Fact]
    public async Task ARefundPutsTheChosenUnitsBackOnSale()
    {
        var (service, order, product, _) = Build();
        await service.UpdateOrderStatusAsync(Reference, new UpdateOrderStatusRequest("paid"), default);

        var refunded = await service.RecordRefundAsync(
            Reference,
            new RecordRefundRequest(12_500, "CASH", "One returned unopened", Restock: [new RestockLine("a", 1)]),
            default);

        Assert.Equal(9, product.Stock);
        Assert.Equal(1, Assert.Single(refunded.Lines).RestockedQuantity);
        Assert.Equal(12_500, refunded.RefundableMinor);
        Assert.Equal("PAID", refunded.Status);
    }

    [Fact]
    public async Task ARefundThatCannotBeFullyAppliedChangesNothing()
    {
        var (service, order, product, _) = Build();
        await service.UpdateOrderStatusAsync(Reference, new UpdateOrderStatusRequest("paid"), default);

        // Three back from an order of two.
        await Assert.ThrowsAsync<ApiException>(() =>
            service.RecordRefundAsync(
                Reference,
                new RecordRefundRequest(12_500, "CASH", "Returned", Restock: [new RestockLine("a", 3)]),
                default));

        Assert.Equal(8, product.Stock);
        Assert.Empty(order.Refunds);
        Assert.Equal(0, order.RefundedMinor);
    }

    [Fact]
    public async Task RefusesToRefundMoreThanIsLeft()
    {
        var (service, _, _, _) = Build();
        await service.UpdateOrderStatusAsync(Reference, new UpdateOrderStatusRequest("paid"), default);
        await service.RecordRefundAsync(Reference, new RecordRefundRequest(20_000, "MOBILE_MONEY", "Late"), default);

        var refused = await Assert.ThrowsAsync<ApiException>(() =>
            service.RecordRefundAsync(Reference, new RecordRefundRequest(5_001, "MOBILE_MONEY", "Late"), default));

        Assert.Equal(ApiErrorCode.Conflict, refused.Code);
        Assert.Contains(Money.Format(5_000), refused.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task AnOrderOnTheRoadCannotBeRefunded()
    {
        var (service, _, _, _) = Build(PaymentMethod.Hubtel);
        await service.UpdateOrderStatusAsync(Reference, new UpdateOrderStatusRequest("paid"), default);
        await service.DispatchAsync(Reference, Rider, default);

        await Assert.ThrowsAsync<ApiException>(() =>
            service.RecordRefundAsync(Reference, new RecordRefundRequest(1_000, "CASH", "Changed mind"), default));
    }
}
