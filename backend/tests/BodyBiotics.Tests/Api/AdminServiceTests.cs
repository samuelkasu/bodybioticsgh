using BodyBiotics.Api.Features.Promotions;
using BodyBiotics.Api.Features.Admin;
using BodyBiotics.Api.Http;
using BodyBiotics.Domain.Common;
using BodyBiotics.Domain.Entities;
using BodyBiotics.Tests.Fakes;

namespace BodyBiotics.Tests.Api;

public class AdminServiceTests
{
    private static Product Product(string id, int stock) => new()
    {
        Id = id,
        Slug = id,
        Name = $"Product {id}",
        Description = string.Empty,
        PriceMinor = 12_500,
        Stock = stock,
        Active = true,
        ImageUrl = $"/catalog/{id}/main.webp",
    };

    private static Order Order(
        string reference,
        Product product,
        int quantity = 2,
        DateTimeOffset? placedAt = null) => new()
    {
        Id = Identifier.New(),
        Reference = reference,
        CreatedAt = placedAt ?? DateTimeOffset.UtcNow,
        Email = "ama@example.com",
        FullName = "Ama Mensah",
        Phone = "0241234567",
        AddressLine = "12 Oxford Street",
        City = "Accra",
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

    private static (AdminService Service, FakeAdminRepository Repository) Build(
        params Product[] catalogue)
    {
        var repository = new FakeAdminRepository(catalogue);
        var service = new AdminService(
            repository,
            new TestMail().Notifier,
            new PricingService(new FakePromotionRepository()),
            new UpdateOrderStatusRequestValidator(),
            new UpdateProductRequestValidator());

        return (service, repository);
    }

    [Fact]
    public async Task ListsOrdersWithTheDetailsNeededToRingTheCustomer()
    {
        var product = Product("a", 10);
        var (service, repository) = Build(product);
        repository.Orders.Add(Order("BB-20260917-AAAAAAAA", product));

        var result = await service.ListOrdersAsync(null, null, null, null, 1, 25, default);

        Assert.Equal(1, result.Total);
        Assert.Equal("0241234567", result.Items[0].Phone);
        Assert.Equal("12 Oxford Street", result.Items[0].AddressLine);
    }

    [Fact]
    public async Task FiltersTheQueueByStatus()
    {
        var product = Product("a", 10);
        var (service, repository) = Build(product);

        var paid = Order("BB-20260917-PAID0000", product);
        paid.TryTransitionTo(OrderStatus.Paid);
        repository.Orders.Add(paid);
        repository.Orders.Add(Order("BB-20260917-PENDING0", product));

        var pending = await service.ListOrdersAsync("pending", null, null, null, 1, 25, default);

        Assert.Equal(1, pending.Total);
        Assert.Equal("BB-20260917-PENDING0", pending.Items[0].Reference);
    }

    [Theory]
    // Whatever the customer gave over the phone is the search term.
    [InlineData("PENDING0")]
    [InlineData("ama mensah")]
    [InlineData("0241234567")]
    [InlineData("accra")]
    [InlineData("AMA@EXAMPLE.COM")]
    public async Task SearchesTheQueueByAnythingStaffWereGiven(string term)
    {
        var product = Product("a", 10);
        var (service, repository) = Build(product);
        repository.Orders.Add(Order("BB-20260917-PENDING0", product));

        var result = await service.ListOrdersAsync(null, term, null, null, 1, 25, default);

        Assert.Equal(1, result.Total);
        Assert.Equal("BB-20260917-PENDING0", result.Items[0].Reference);
    }

    [Fact]
    public async Task ExcludesOrdersOutsideTheDateRange()
    {
        var product = Product("a", 10);
        var (service, repository) = Build(product);

        repository.Orders.Add(Order(
            "BB-20260901-OLD00000",
            product,
            placedAt: new DateTimeOffset(2026, 9, 1, 12, 0, 0, TimeSpan.Zero)));
        repository.Orders.Add(Order("BB-20260917-NEW00000", product));

        var day = new DateTimeOffset(2026, 9, 1, 0, 0, 0, TimeSpan.Zero);

        // A single day picked at both ends still has to include that whole day.
        var result = await service.ListOrdersAsync(null, null, day, day, 1, 25, default);

        Assert.Equal(1, result.Total);
        Assert.Equal("BB-20260901-OLD00000", result.Items[0].Reference);
    }

    [Fact]
    public async Task RejectsAStatusFilterThatIsNotAStatus()
    {
        var (service, _) = Build();

        await Assert.ThrowsAsync<ApiException>(() =>
            service.ListOrdersAsync("posted", null, null, null, 1, 25, default));
    }

    [Fact]
    public async Task CapsThePageSize()
    {
        var (service, _) = Build();

        var result = await service.ListOrdersAsync(null, null, null, null, 1, 10_000, default);

        // An unbounded page is a slow scan and a data dump of the order book.
        Assert.Equal(AdminService.MaxPerPage, result.PerPage);
    }

    [Fact]
    public async Task MarksAnOrderPaid()
    {
        var product = Product("a", 10);
        var (service, repository) = Build(product);
        repository.Orders.Add(Order("BB-20260917-AAAAAAAA", product));

        var updated = await service.UpdateOrderStatusAsync(
            "BB-20260917-AAAAAAAA",
            new UpdateOrderStatusRequest("paid"),
            default);

        Assert.Equal("PAID", updated.Status);
    }

    [Fact]
    public async Task RefusesATransitionTheStateMachineDoesNotAllow()
    {
        var product = Product("a", 10);
        var (service, repository) = Build(product);
        var order = Order("BB-20260917-AAAAAAAA", product);
        order.TryTransitionTo(OrderStatus.Cancelled);
        repository.Orders.Add(order);

        await Assert.ThrowsAsync<ApiException>(() =>
            service.UpdateOrderStatusAsync(
                "BB-20260917-AAAAAAAA",
                new UpdateOrderStatusRequest("fulfilled"),
                default));
    }

    [Fact]
    public async Task CancellingPutsTheReservedStockBack()
    {
        var product = Product("a", 8);
        var (service, repository) = Build(product);
        repository.Orders.Add(Order("BB-20260917-AAAAAAAA", product, quantity: 2));

        await service.UpdateOrderStatusAsync(
            "BB-20260917-AAAAAAAA",
            new UpdateOrderStatusRequest("cancelled"),
            default);

        // Checkout took the stock when the order was placed; nothing else
        // gives it back, so a cancellation that skipped this would keep the
        // items out of the catalogue permanently.
        Assert.Equal(10, product.Stock);
    }

    [Fact]
    public async Task CancellingTwiceDoesNotInventStock()
    {
        var product = Product("a", 8);
        var (service, repository) = Build(product);
        repository.Orders.Add(Order("BB-20260917-AAAAAAAA", product, quantity: 2));

        await service.UpdateOrderStatusAsync(
            "BB-20260917-AAAAAAAA",
            new UpdateOrderStatusRequest("cancelled"),
            default);
        // TryTransitionTo reports success for a transition already applied, so
        // a double-clicked Cancel must not release the stock a second time.
        await service.UpdateOrderStatusAsync(
            "BB-20260917-AAAAAAAA",
            new UpdateOrderStatusRequest("cancelled"),
            default);

        Assert.Equal(10, product.Stock);
    }

    [Fact]
    public async Task UpdatesOnlyTheProductFieldsThatWereSent()
    {
        var product = Product("a", 8);
        var (service, _) = Build(product);

        await service.UpdateProductAsync(
            "a",
            new UpdateProductRequest(PriceMinor: null, Stock: 20, Active: null, null, null, null),
            default);

        Assert.Equal(20, product.Stock);
        // Untouched: a stale form must not revert a price someone else fixed.
        Assert.Equal(12_500, product.PriceMinor);
        Assert.True(product.Active);
    }

    [Fact]
    public async Task RefusesANegativePriceOrStock()
    {
        var (service, _) = Build(Product("a", 8));

        await Assert.ThrowsAnyAsync<Exception>(() =>
            service.UpdateProductAsync("a", new UpdateProductRequest(-1, null, null, null, null, null), default));
    }

    [Fact]
    public async Task RefusesAnEmptyProductUpdate()
    {
        var (service, _) = Build(Product("a", 8));

        await Assert.ThrowsAnyAsync<Exception>(() =>
            service.UpdateProductAsync("a", new UpdateProductRequest(null, null, null, null, null, null), default));
    }

    [Fact]
    public async Task ListsInactiveProductsSoTheyCanBePutBack()
    {
        var withdrawn = Product("a", 0);
        withdrawn.Active = false;
        var (service, _) = Build(withdrawn, Product("b", 5));

        var result = await service.ListProductsAsync(null, 1, 25, default);

        // The storefront list hides inactive products, so without this staff
        // could deactivate one and never find it again.
        Assert.Equal(2, result.Total);
        Assert.Contains(result.Items, product => product.Id == "a");
    }

    [Fact]
    public async Task ReportsAMissingOrder()
    {
        var (service, _) = Build();

        await Assert.ThrowsAsync<ApiException>(() =>
            service.GetOrderAsync("BB-20260917-NOPE0000", default));
    }
}
