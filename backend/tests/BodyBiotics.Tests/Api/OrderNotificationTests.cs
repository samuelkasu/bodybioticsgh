using BodyBiotics.Api.Features.Promotions;
using BodyBiotics.Api.Features.Admin;
using BodyBiotics.Api.Features.Checkout;
using BodyBiotics.Api.Features.Payments;
using BodyBiotics.Domain.Abstractions;
using BodyBiotics.Domain.Common;
using BodyBiotics.Domain.Entities;
using BodyBiotics.Tests.Fakes;
using Microsoft.Extensions.Logging.Abstractions;

namespace BodyBiotics.Tests.Api;

using CartEntity = BodyBiotics.Domain.Entities.Cart;

/// <summary>
/// What the customer and the shop actually receive as an order moves. These
/// assert on the queued message rather than on a call being made — the failures
/// worth catching are a receipt going to the wrong address, a product name that
/// never rendered, and a confirmation arriving twice.
/// </summary>
public class OrderNotificationTests
{
    private const string Customer = "customer@example.com";
    private const string ShopInbox = "shop@bodybioticsgh.com";
    private const string AnonId = "anon-1";

    private static readonly CartOwner Owner = CartOwner.ForAnonymous(AnonId);

    private static readonly CheckoutRequest ValidRequest = new(
        Customer,
        "Ama Mensah",
        "0241234567",
        "12 Oxford Street",
        "Accra",
        null,
        "req-1");

    private static Product Product() => new()
    {
        Id = "a",
        Slug = "glow-serum",
        Name = "Glow Serum",
        Description = string.Empty,
        PriceMinor = 12_500,
        Stock = 10,
        Active = true,
        ImageUrl = "/catalog/a/main.webp",
    };

    private static Order Order(Product product, PaymentMethod method = PaymentMethod.OnDelivery) => new()
    {
        Id = Identifier.New(),
        Reference = "BB-20260918-K7QX4M9T",
        Email = Customer,
        FullName = "Ama Mensah",
        Phone = "0241234567",
        AddressLine = "12 Oxford Street",
        City = "Accra",
        PaymentMethod = method,
        TotalMinor = product.PriceMinor * 2,
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

    private static (CheckoutService Service, TestMail Mail) BuildCheckout(Product product)
    {
        var cart = new CartEntity { Id = "cart-1", AnonId = AnonId };
        cart.Items.Add(new CartItem
        {
            Id = Identifier.New(),
            CartId = cart.Id,
            ProductId = product.Id,
            Product = product,
            Quantity = 2,
        });

        var carts = new FakeCartRepository();
        carts.Carts.Add(cart);

        var mail = new TestMail(shopInbox: ShopInbox);

        return (
            new CheckoutService(
                carts,
                new FakeProductRepository(product),
                new FakeOrderRepository(),
                new FakeUnitOfWork(),
                new FakePaymentGateway(),
                mail.Notifier,
                new PricingService(new FakePromotionRepository()),
                new CheckoutRequestValidator()),
            mail);
    }

    private static (AdminService Service, FakeAdminRepository Repository, TestMail Mail) BuildAdmin(
        Product product,
        Order order)
    {
        var repository = new FakeAdminRepository(product);
        repository.Orders.Add(order);

        var mail = new TestMail(shopInbox: ShopInbox);

        return (
            new AdminService(
                repository,
                mail.Notifier,
                new PricingService(new FakePromotionRepository()),
                new UpdateOrderStatusRequestValidator(),
                new UpdateProductRequestValidator(),
            new DispatchOrderRequestValidator(),
            new CompleteDeliveryRequestValidator(),
            new FailDeliveryRequestValidator(),
            new RecordRefundRequestValidator()),
            repository,
            mail);
    }

    [Fact]
    public async Task ConfirmsAPlacedOrderToTheCustomerAndAlertsTheShop()
    {
        var (service, mail) = BuildCheckout(Product());

        await service.PlaceOrderAsync(Owner, null, ValidRequest, default);

        var sent = mail.Drain();
        Assert.Equal(2, sent.Count);

        var confirmation = Assert.Single(sent, message => message.To == Customer);
        Assert.Contains("received", confirmation.Subject, StringComparison.OrdinalIgnoreCase);

        var alert = Assert.Single(sent, message => message.To == ShopInbox);
        // Replying to the alert must answer the customer, not the shop itself.
        Assert.Equal(Customer, alert.ReplyTo);
    }

    [Fact]
    public async Task TheConfirmationNamesTheProductAndTheTotal()
    {
        var (service, mail) = BuildCheckout(Product());

        await service.PlaceOrderAsync(Owner, null, ValidRequest, default);

        var confirmation = Assert.Single(mail.DrainFor(Customer));
        // Both bodies: a client that strips HTML still has to show a receipt.
        Assert.Contains("Glow Serum", confirmation.HtmlBody, StringComparison.Ordinal);
        Assert.Contains("Glow Serum", confirmation.TextBody, StringComparison.Ordinal);
        Assert.Contains(Money.Format(25_000), confirmation.TextBody, StringComparison.Ordinal);
    }

    [Fact]
    public async Task ARetriedCheckoutDoesNotSendASecondConfirmation()
    {
        var (service, mail) = BuildCheckout(Product());

        await service.PlaceOrderAsync(Owner, null, ValidRequest, default);
        mail.Drain();

        // Same requestId: the offline queue replaying, or a customer on a flaky
        // connection pressing the button again.
        await service.PlaceOrderAsync(Owner, null, ValidRequest, default);

        Assert.Empty(mail.Drain());
    }

    [Fact]
    public async Task TellsTheCustomerWhenTheirOrderGoesOut()
    {
        var product = Product();
        var order = Order(product);
        var (service, _, mail) = BuildAdmin(product, order);

        await service.DispatchAsync(
            order.Reference,
            new DispatchOrderRequest("RIDER", "Kofi Boateng", "0241112222"),
            default);

        var dispatch = Assert.Single(mail.DrainFor(Customer));
        Assert.Contains("on its way", dispatch.Subject, StringComparison.OrdinalIgnoreCase);
        // Who is coming and how to reach them, so an unknown number ringing
        // is answered rather than ignored.
        Assert.Contains("Kofi Boateng", dispatch.TextBody, StringComparison.Ordinal);
        Assert.Contains("0241112222", dispatch.TextBody, StringComparison.Ordinal);
        // Pay on delivery: the rider is collecting money, so the amount has to
        // be in the message the customer reads before answering the door.
        Assert.Contains(Money.Format(25_000), dispatch.TextBody, StringComparison.Ordinal);
    }

    [Fact]
    public async Task ARefundEmailSaysHowMuchWentBackAndWhere()
    {
        var product = Product();
        var order = Order(product);
        var (service, _, mail) = BuildAdmin(product, order);

        await service.UpdateOrderStatusAsync(order.Reference, new UpdateOrderStatusRequest("PAID"), default);
        mail.Drain();

        await service.RecordRefundAsync(
            order.Reference,
            new RecordRefundRequest(5_000, "MOBILE_MONEY", "Damaged bottle", "MM-778899"),
            default);

        var refund = Assert.Single(mail.DrainFor(Customer));
        Assert.Contains(Money.Format(5_000), refund.Subject, StringComparison.Ordinal);
        Assert.Contains("Mobile Money", refund.TextBody, StringComparison.Ordinal);
        Assert.Contains("MM-778899", refund.TextBody, StringComparison.Ordinal);
        Assert.Contains("partial refund", refund.TextBody, StringComparison.Ordinal);
    }

    [Fact]
    public async Task DoesNotThankAPayOnDeliveryCustomerForPayingOnline()
    {
        var product = Product();
        var order = Order(product);
        var (service, _, mail) = BuildAdmin(product, order);

        await service.UpdateOrderStatusAsync(order.Reference, new UpdateOrderStatusRequest("PAID"), default);

        // Marking a pay-on-delivery order Paid means the rider took the cash.
        // A "payment received, we are packing it now" email then reads as a
        // mistake to someone who has already had their delivery.
        Assert.Empty(mail.Drain());
    }

    [Fact]
    public async Task ReapplyingAStatusDoesNotSendASecondEmail()
    {
        var product = Product();
        var order = Order(product);
        var (service, _, mail) = BuildAdmin(product, order);

        await service.UpdateOrderStatusAsync(order.Reference, new UpdateOrderStatusRequest("CANCELLED"), default);
        Assert.Single(mail.Drain());

        // TryTransitionTo accepts a repeat, so the guard has to be here.
        await service.UpdateOrderStatusAsync(order.Reference, new UpdateOrderStatusRequest("CANCELLED"), default);

        Assert.Empty(mail.Drain());
    }

    [Fact]
    public async Task SendsOneReceiptHoweverManyTimesAPaymentIsReconciled()
    {
        var product = Product();
        var order = Order(product, PaymentMethod.Hubtel);
        var repository = new FakeAdminRepository(product);
        repository.Orders.Add(order);

        var gateway = new FakePaymentGateway
        {
            NextStatus = new PaymentStatus(PaymentState.Paid, 25_000, "txn-1", "mobilemoney"),
        };
        var mail = new TestMail(shopInbox: ShopInbox);
        var service = new PaymentService(
            repository,
            new FakeUnitOfWork(),
            gateway,
            mail.Notifier,
            NullLogger<PaymentService>.Instance);

        await service.ReconcileAsync(order.Reference, default);
        Assert.Single(mail.DrainFor(Customer));

        // Hubtel retries its callback, and the order page polls as well.
        await service.ReconcileAsync(order.Reference, default);

        Assert.Empty(mail.Drain());
    }
}
