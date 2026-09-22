using BodyBiotics.Api.Features.Promotions;
using BodyBiotics.Api.Features.Checkout;
using BodyBiotics.Api.Http;
using BodyBiotics.Domain.Abstractions;
using BodyBiotics.Domain.Common;
using BodyBiotics.Domain.Entities;
using BodyBiotics.Tests.Fakes;

namespace BodyBiotics.Tests.Api;

using CartEntity = BodyBiotics.Domain.Entities.Cart;

public class CheckoutServiceTests
{
    private const string AnonId = "anon-1";

    private static readonly CartOwner Owner = CartOwner.ForAnonymous(AnonId);

    private static readonly CheckoutRequest ValidRequest = new(
        "customer@example.com",
        "Ama Mensah",
        "0241234567",
        "12 Oxford Street",
        "Accra",
        null,
        "req-1",
        "accra-central");

    private static Product Product(string id, int priceMinor, int stock) => new()
    {
        Id = id,
        Slug = $"product-{id}",
        Name = $"Product {id}",
        Description = "Test product",
        PriceMinor = priceMinor,
        ImageUrl = "/catalog/test/main.webp",
        Stock = stock,
    };

    private static (CheckoutService Service, FakeCartRepository Carts, FakeOrderRepository Orders, FakeProductRepository Products)
        Build(params (Product Product, int Quantity)[] lines) =>
        Build(new FakePaymentGateway(), lines);

    private static (CheckoutService Service, FakeCartRepository Carts, FakeOrderRepository Orders, FakeProductRepository Products)
        Build(FakePaymentGateway gateway, params (Product Product, int Quantity)[] lines)
    {
        var products = new FakeProductRepository([.. lines.Select(line => line.Product)]);
        var carts = new FakeCartRepository();
        var orders = new FakeOrderRepository();

        var cart = new CartEntity { Id = "cart-1", AnonId = AnonId };
        foreach (var (product, quantity) in lines)
        {
            cart.Items.Add(new CartItem
            {
                Id = Guid.NewGuid().ToString("N"),
                CartId = cart.Id,
                ProductId = product.Id,
                Product = product,
                Quantity = quantity,
            });
        }

        carts.Carts.Add(cart);

        var service = new CheckoutService(
            carts,
            products,
            orders,
            new FakeUnitOfWork(),
            gateway,
            new TestMail().Notifier,
            new PricingService(new FakePromotionRepository()),
            new CheckoutRequestValidator());

        return (service, carts, orders, products);
    }

    [Fact]
    public async Task PricesTheOrderFromTheCatalogue()
    {
        var (service, _, _, _) = Build((Product("a", 12_500, 10), 2), (Product("b", 9_900, 10), 3));

        var (order, created) = await service.PlaceOrderAsync(Owner, null, ValidRequest, default);

        var goods = (12_500 * 2) + (9_900 * 3);

        Assert.True(created);
        Assert.Equal(goods, order.SubtotalMinor);
        Assert.Equal(2_000, order.DeliveryFeeMinor);
        Assert.Equal(goods + 2_000, order.TotalMinor);
        Assert.Equal("PENDING", order.Status);
        Assert.Equal(Money.DefaultCurrency, order.Currency);
    }

    [Fact]
    public async Task ChargesTheDeliveryFeeForTheChosenArea()
    {
        var (service, _, _, _) = Build((Product("a", 10_000, 10), 1));

        var (order, _) = await service.PlaceOrderAsync(
            Owner,
            null,
            ValidRequest with { DeliveryZone = "kumasi" },
            default);

        Assert.Equal("kumasi", order.DeliveryZone);
        Assert.Equal("Kumasi", order.DeliveryZoneName);
        Assert.Equal(4_500, order.DeliveryFeeMinor);
        Assert.Equal(14_500, order.TotalMinor);
    }

    [Fact]
    public async Task WaivesDeliveryOnceTheBasketPassesTheThreshold()
    {
        var (service, _, _, _) = Build(
            (Product("a", DeliveryZones.FreeDeliveryThresholdMinor, 10), 1));

        var (order, _) = await service.PlaceOrderAsync(
            Owner,
            null,
            ValidRequest with { DeliveryZone = "other" },
            default);

        Assert.Equal(0, order.DeliveryFeeMinor);
        Assert.Equal(DeliveryZones.FreeDeliveryThresholdMinor, order.TotalMinor);
    }

    [Fact]
    public async Task FallsBackToTheDearestAreaWhenTheClientSendsNone()
    {
        // An older client that does not know about zones must not have its
        // delivery quietly absorbed by the shop.
        var (service, _, _, _) = Build((Product("a", 10_000, 10), 1));

        var (order, _) = await service.PlaceOrderAsync(
            Owner,
            null,
            ValidRequest with { DeliveryZone = null },
            default);

        Assert.Equal(DeliveryZones.DefaultZoneCode, order.DeliveryZone);
        Assert.Equal(6_000, order.DeliveryFeeMinor);
    }

    [Theory]
    [InlineData("0241234567")]
    [InlineData("+233 24 123 4567")]
    [InlineData("(024) 123-4567")]
    public void AcceptsGhanaianNumbersHoweverTheyAreTyped(string phone)
    {
        var result = new CheckoutRequestValidator()
            .Validate(ValidRequest with { Phone = phone });

        Assert.True(result.IsValid);
    }

    [Theory]
    [InlineData("+++ ((( ---")]
    [InlineData("024 12")]
    [InlineData("02412345678901234")]
    public void RejectsNumbersNobodyCouldBeCalledOn(string phone)
    {
        var result = new CheckoutRequestValidator()
            .Validate(ValidRequest with { Phone = phone });

        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task RejectsAnAreaTheShopDoesNotDeliverTo()
    {
        var (service, _, _, _) = Build((Product("a", 10_000, 10), 1));

        await Assert.ThrowsAsync<FluentValidation.ValidationException>(
            () => service.PlaceOrderAsync(
                Owner,
                null,
                ValidRequest with { DeliveryZone = "lagos" },
                default));
    }

    [Fact]
    public async Task CopiesUnitPricesOntoTheOrderLines()
    {
        var product = Product("a", 12_500, 10);
        var (service, _, _, _) = Build((product, 2));

        var (order, _) = await service.PlaceOrderAsync(Owner, null, ValidRequest, default);

        // Changing the catalogue afterwards must not rewrite the receipt.
        product.PriceMinor = 99_900;

        var line = Assert.Single(order.Lines);
        Assert.Equal(12_500, line.UnitPriceMinor);
        Assert.Equal(25_000, line.LineTotalMinor);
    }

    [Fact]
    public async Task ReservesStockForEveryLine()
    {
        var product = Product("a", 12_500, 10);
        var (service, _, _, _) = Build((product, 4));

        await service.PlaceOrderAsync(Owner, null, ValidRequest, default);

        Assert.Equal(6, product.Stock);
    }

    [Fact]
    public async Task EmptiesTheCartOnSuccess()
    {
        var (service, carts, _, _) = Build((Product("a", 12_500, 10), 1));

        await service.PlaceOrderAsync(Owner, null, ValidRequest, default);

        Assert.Empty(carts.Carts[0].Items);
    }

    [Fact]
    public async Task ARetriedRequestReturnsTheSameOrderAndDoesNotReserveAgain()
    {
        var product = Product("a", 12_500, 10);
        var (service, _, orders, _) = Build((product, 3));

        var (first, firstCreated) = await service.PlaceOrderAsync(Owner, null, ValidRequest, default);
        var (second, secondCreated) = await service.PlaceOrderAsync(Owner, null, ValidRequest, default);

        Assert.True(firstCreated);
        // This is the whole point of the idempotency key on a flaky connection.
        Assert.False(secondCreated);
        Assert.Equal(first.Reference, second.Reference);
        Assert.Single(orders.Orders);
        Assert.Equal(7, product.Stock);
    }

    [Fact]
    public async Task RefusesWhenALineExceedsStock()
    {
        var product = Product("a", 12_500, 2);
        var (service, _, orders, _) = Build((product, 5));

        var error = await Assert.ThrowsAsync<ApiException>(() =>
            service.PlaceOrderAsync(Owner, null, ValidRequest, default));

        Assert.Equal(ApiErrorCode.Conflict, error.Code);
        Assert.Empty(orders.Orders);
        Assert.Equal(2, product.Stock);
    }

    [Fact]
    public async Task RefusesAnInactiveProduct()
    {
        var product = Product("a", 12_500, 10);
        product.Active = false;
        var (service, _, _, _) = Build((product, 1));

        var error = await Assert.ThrowsAsync<ApiException>(() =>
            service.PlaceOrderAsync(Owner, null, ValidRequest, default));

        Assert.Equal(ApiErrorCode.Conflict, error.Code);
    }

    [Fact]
    public async Task RefusesAnEmptyCart()
    {
        var carts = new FakeCartRepository();
        carts.Carts.Add(new CartEntity { Id = "cart-1", AnonId = AnonId });

        var service = new CheckoutService(
            carts,
            new FakeProductRepository(),
            new FakeOrderRepository(),
            new FakeUnitOfWork(),
            new FakePaymentGateway(),
            new TestMail().Notifier,
            new PricingService(new FakePromotionRepository()),
            new CheckoutRequestValidator());

        var error = await Assert.ThrowsAsync<ApiException>(() =>
            service.PlaceOrderAsync(Owner, null, ValidRequest, default));

        Assert.Equal(ApiErrorCode.BadRequest, error.Code);
    }

    [Fact]
    public async Task RefusesWhenThereIsNoCartAtAll()
    {
        var service = new CheckoutService(
            new FakeCartRepository(),
            new FakeProductRepository(),
            new FakeOrderRepository(),
            new FakeUnitOfWork(),
            new FakePaymentGateway(),
            new TestMail().Notifier,
            new PricingService(new FakePromotionRepository()),
            new CheckoutRequestValidator());

        await Assert.ThrowsAsync<ApiException>(() =>
            service.PlaceOrderAsync(Owner, null, ValidRequest, default));
    }

    [Fact]
    public async Task AttributesTheOrderToASignedInUser()
    {
        var (service, _, orders, _) = Build((Product("a", 12_500, 10), 1));

        await service.PlaceOrderAsync(Owner, "user-1", ValidRequest, default);

        Assert.Equal("user-1", orders.Orders[0].UserId);
    }

    [Fact]
    public async Task KeepsTheDeliveryDetailsTheCustomerEntered()
    {
        var (service, _, orders, _) = Build((Product("a", 12_500, 10), 1));

        var (dto, _) = await service.PlaceOrderAsync(Owner, null, ValidRequest, default);

        // These were validated and then thrown away, which left an order nobody
        // could ring about or deliver.
        var stored = orders.Orders[0];
        Assert.Equal(ValidRequest.FullName, stored.FullName);
        Assert.Equal(ValidRequest.Phone, stored.Phone);
        Assert.Equal(ValidRequest.AddressLine, stored.AddressLine);
        Assert.Equal(ValidRequest.City, stored.City);
        Assert.Equal(ValidRequest.FullName, dto.FullName);
        Assert.Equal(ValidRequest.AddressLine, dto.AddressLine);
    }

    [Fact]
    public async Task DefaultsToPayOnDeliveryAndDoesNotTouchTheProvider()
    {
        var gateway = new FakePaymentGateway();
        var (service, _, orders, _) = Build(gateway, (Product("a", 12_500, 10), 1));

        var (order, _) = await service.PlaceOrderAsync(Owner, null, ValidRequest, default);

        Assert.Equal("ON_DELIVERY", order.PaymentMethod);
        Assert.Null(order.CheckoutUrl);
        Assert.Empty(gateway.Started);
        Assert.Equal(PaymentMethod.OnDelivery, orders.Orders[0].PaymentMethod);
    }

    [Fact]
    public async Task AnOnlineOrderComesBackWithSomewhereToPay()
    {
        var gateway = new FakePaymentGateway();
        var (service, _, orders, _) = Build(gateway, (Product("a", 12_500, 10), 1));

        var (order, _) = await service.PlaceOrderAsync(
            Owner,
            null,
            ValidRequest with { PaymentMethod = "HUBTEL" },
            default);

        Assert.Equal("HUBTEL", order.PaymentMethod);
        Assert.Equal($"https://checkout.test/{order.Reference}", order.CheckoutUrl);
        Assert.Single(gateway.Started);
        Assert.Equal($"chk_{order.Reference}", orders.Orders[0].PaymentReference);
    }

    [Fact]
    public async Task RefusesOnlinePaymentWhenTheProviderIsNotConfigured()
    {
        var gateway = new FakePaymentGateway { IsConfigured = false };
        var (service, _, orders, _) = Build(gateway, (Product("a", 12_500, 10), 1));

        var error = await Assert.ThrowsAsync<ApiException>(() =>
            service.PlaceOrderAsync(
                Owner,
                null,
                ValidRequest with { PaymentMethod = "HUBTEL" },
                default));

        // Better a clear refusal than an order nobody can pay for.
        Assert.Equal(ApiErrorCode.Conflict, error.Code);
        Assert.Empty(orders.Orders);
    }

    [Fact]
    public async Task AnUnreachableProviderCancelsTheOrderAndReturnsTheStock()
    {
        var gateway = new FakePaymentGateway { FailToStart = true };
        var product = Product("a", 12_500, 10);
        var (service, _, orders, _) = Build(gateway, (product, 3));

        await Assert.ThrowsAsync<ApiException>(() =>
            service.PlaceOrderAsync(
                Owner,
                null,
                ValidRequest with { PaymentMethod = "HUBTEL" },
                default));

        // The order exists but can never be paid, so it must not sit there
        // holding stock out of the catalogue.
        Assert.Equal(OrderStatus.Cancelled, orders.Orders[0].Status);
        Assert.Equal(10, product.Stock);
    }

    [Fact]
    public async Task AGuestOrderIsReadableByTheBrowserThatPlacedIt()
    {
        var (service, _, _, _) = Build((Product("a", 12_500, 10), 1));
        var (order, _) = await service.PlaceOrderAsync(Owner, null, ValidRequest, default);

        var fetched = await service.GetAsync(
            order.Reference,
            null,
            guestAccessGranted: true,
            default);

        Assert.Equal(order.Reference, fetched.Reference);
    }

    [Fact]
    public async Task AGuestOrderIsNotReadableByReferenceAlone()
    {
        var (service, _, _, _) = Build((Product("a", 12_500, 10), 1));
        var (order, _) = await service.PlaceOrderAsync(Owner, null, ValidRequest, default);

        // Someone who guessed the reference has no grant, so the order is not
        // theirs to read — this is what stops the day's orders being walked.
        await Assert.ThrowsAsync<ApiException>(() =>
            service.GetAsync(order.Reference, null, guestAccessGranted: false, default));
    }

    [Fact]
    public async Task AnotherCustomerCannotReadSomeoneElsesOrder()
    {
        var (service, _, _, _) = Build((Product("a", 12_500, 10), 1));
        var (order, _) = await service.PlaceOrderAsync(Owner, "user-1", ValidRequest, default);

        await Assert.ThrowsAsync<ApiException>(() =>
            service.GetAsync(order.Reference, "user-2", guestAccessGranted: false, default));
    }

    [Fact]
    public async Task AGrantDoesNotOpenAnotherCustomersOrder()
    {
        var (service, _, _, _) = Build((Product("a", 12_500, 10), 1));
        var (order, _) = await service.PlaceOrderAsync(Owner, "user-1", ValidRequest, default);

        // A stale grant cookie must not reach an order that now belongs to an
        // account: the grant only ever covers guest orders.
        await Assert.ThrowsAsync<ApiException>(() =>
            service.GetAsync(order.Reference, null, guestAccessGranted: true, default));
    }

    [Theory]
    [InlineData("not-an-email", "Ama", "0241234567", "12 Oxford Street", "Accra")]
    [InlineData("a@b.com", "", "0241234567", "12 Oxford Street", "Accra")]
    [InlineData("a@b.com", "Ama", "abc", "12 Oxford Street", "Accra")]
    [InlineData("a@b.com", "Ama", "0241234567", "", "Accra")]
    [InlineData("a@b.com", "Ama", "0241234567", "12 Oxford Street", "")]
    public async Task RejectsAnIncompleteDeliveryAddress(
        string email,
        string name,
        string phone,
        string address,
        string city)
    {
        var (service, _, _, _) = Build((Product("a", 12_500, 10), 1));
        var request = new CheckoutRequest(email, name, phone, address, city, null, "req-2");

        await Assert.ThrowsAsync<FluentValidation.ValidationException>(() =>
            service.PlaceOrderAsync(Owner, null, request, default));
    }
}
