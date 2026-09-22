using BodyBiotics.Api.Features.Promotions;
using BodyBiotics.Api.Features.Cart;
using BodyBiotics.Api.Http;
using BodyBiotics.Domain.Abstractions;
using BodyBiotics.Domain.Entities;
using BodyBiotics.Tests.Fakes;

namespace BodyBiotics.Tests.Api;

using CartEntity = BodyBiotics.Domain.Entities.Cart;

public class CartServiceTests
{
    private static readonly CartOwner Anonymous = CartOwner.ForAnonymous("anon-1");

    private static Product Product(string id = "a", int priceMinor = 12_500, int stock = 10) => new()
    {
        Id = id,
        Slug = $"product-{id}",
        Name = $"Product {id}",
        Description = "Test product",
        PriceMinor = priceMinor,
        ImageUrl = "/catalog/test/main.webp",
        Stock = stock,
    };

    private static CartService Build(FakeCartRepository carts, params Product[] products) =>
        new(carts,
            new FakeProductRepository(products),
            new PricingService(new FakePromotionRepository()),
            new AddToCartRequestValidator(),
            new UpdateCartLineRequestValidator(),
            new ApplyCouponRequestValidator());

    [Fact]
    public async Task AnUnknownVisitorHasAnEmptyCart()
    {
        var cart = await Build(new FakeCartRepository()).GetAsync(Anonymous, default);

        Assert.Empty(cart.Lines);
        Assert.Equal(0, cart.ItemCount);
        Assert.Equal(0, cart.SubtotalMinor);
    }

    [Fact]
    public async Task AddingCreatesTheCartAndPricesTheLine()
    {
        var product = Product();
        var service = Build(new FakeCartRepository(), product);

        var cart = await service.AddAsync(Anonymous, new AddToCartRequest(product.Id, 2), default);

        var line = Assert.Single(cart.Lines);
        Assert.Equal(2, line.Quantity);
        Assert.Equal(25_000, line.LineTotalMinor);
        Assert.Equal(25_000, cart.SubtotalMinor);
    }

    [Fact]
    public async Task AddingTheSameProductAccumulates()
    {
        var product = Product();
        var service = Build(new FakeCartRepository(), product);

        await service.AddAsync(Anonymous, new AddToCartRequest(product.Id, 2), default);
        var cart = await service.AddAsync(Anonymous, new AddToCartRequest(product.Id, 3), default);

        Assert.Equal(5, Assert.Single(cart.Lines).Quantity);
    }

    [Fact]
    public async Task QuantityIsCappedPerLine()
    {
        var product = Product();
        var service = Build(new FakeCartRepository(), product);

        await service.AddAsync(Anonymous, new AddToCartRequest(product.Id, 60), default);
        var cart = await service.AddAsync(Anonymous, new AddToCartRequest(product.Id, 60), default);

        Assert.Equal(CartItem.MaxQuantityPerLine, Assert.Single(cart.Lines).Quantity);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(100)]
    public async Task RejectsAnAbsurdQuantity(int quantity)
    {
        var product = Product();
        var service = Build(new FakeCartRepository(), product);

        await Assert.ThrowsAsync<FluentValidation.ValidationException>(() =>
            service.AddAsync(Anonymous, new AddToCartRequest(product.Id, quantity), default));
    }

    [Fact]
    public async Task RejectsAnUnknownProduct()
    {
        var service = Build(new FakeCartRepository());

        var error = await Assert.ThrowsAsync<ApiException>(() =>
            service.AddAsync(Anonymous, new AddToCartRequest("ghost"), default));

        Assert.Equal(ApiErrorCode.NotFound, error.Code);
    }

    [Fact]
    public async Task RejectsAnInactiveProduct()
    {
        var product = Product();
        product.Active = false;
        var service = Build(new FakeCartRepository(), product);

        var error = await Assert.ThrowsAsync<ApiException>(() =>
            service.AddAsync(Anonymous, new AddToCartRequest(product.Id), default));

        Assert.Equal(ApiErrorCode.Conflict, error.Code);
    }

    [Fact]
    public async Task RejectsAnOutOfStockProduct()
    {
        // Caught at add time, not at checkout, so a customer never fills a cart
        // with things they cannot buy.
        var product = Product(stock: 0);
        var service = Build(new FakeCartRepository(), product);

        var error = await Assert.ThrowsAsync<ApiException>(() =>
            service.AddAsync(Anonymous, new AddToCartRequest(product.Id), default));

        Assert.Equal(ApiErrorCode.Conflict, error.Code);
        Assert.Contains("out of stock", error.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task SettingQuantityToZeroRemovesTheLine()
    {
        var product = Product();
        var service = Build(new FakeCartRepository(), product);
        await service.AddAsync(Anonymous, new AddToCartRequest(product.Id, 3), default);

        var cart = await service.UpdateAsync(
            Anonymous,
            new UpdateCartLineRequest(product.Id, 0),
            default);

        Assert.Empty(cart.Lines);
    }

    [Fact]
    public async Task UpdatingAMissingLineIsANoOp()
    {
        var product = Product();
        var service = Build(new FakeCartRepository(), product);
        await service.AddAsync(Anonymous, new AddToCartRequest(product.Id, 1), default);

        var cart = await service.UpdateAsync(
            Anonymous,
            new UpdateCartLineRequest("ghost", 5),
            default);

        Assert.Single(cart.Lines);
    }

    [Fact]
    public async Task ClearingEmptiesEverything()
    {
        var product = Product();
        var service = Build(new FakeCartRepository(), product);
        await service.AddAsync(Anonymous, new AddToCartRequest(product.Id, 3), default);

        var cart = await service.ClearAsync(Anonymous, default);

        Assert.Empty(cart.Lines);
        Assert.Equal(0, cart.ItemCount);
    }

    [Fact]
    public async Task FlagsALineThatOutgrewItsStock()
    {
        var product = Product(stock: 10);
        var service = Build(new FakeCartRepository(), product);
        await service.AddAsync(Anonymous, new AddToCartRequest(product.Id, 8), default);

        // Someone else bought the rest while this cart sat open.
        product.Stock = 3;
        var cart = await service.GetAsync(Anonymous, default);

        Assert.True(cart.HasUnavailableLines);
    }

    [Fact]
    public async Task MergeMovesAnonymousLinesOntoTheAccount()
    {
        var product = Product();
        var carts = new FakeCartRepository();
        var service = Build(carts, product);
        await service.AddAsync(Anonymous, new AddToCartRequest(product.Id, 2), default);

        await service.MergeAsync("anon-1", "user-1", default);

        var userCart = await service.GetAsync(CartOwner.ForUser("user-1"), default);
        Assert.Equal(2, Assert.Single(userCart.Lines).Quantity);
        // The anonymous cart must not linger and resurrect itself later.
        Assert.DoesNotContain(carts.Carts, cart => cart.AnonId == "anon-1");
    }

    [Fact]
    public async Task MergeSumsQuantitiesForAProductInBothCarts()
    {
        var product = Product();
        var carts = new FakeCartRepository();
        var user = CartOwner.ForUser("user-1");
        var service = Build(carts, product);

        await service.AddAsync(user, new AddToCartRequest(product.Id, 4), default);
        await service.AddAsync(Anonymous, new AddToCartRequest(product.Id, 3), default);

        await service.MergeAsync("anon-1", "user-1", default);

        Assert.Equal(7, Assert.Single((await service.GetAsync(user, default)).Lines).Quantity);
    }

    [Fact]
    public async Task MergeRespectsThePerLineCap()
    {
        var product = Product();
        var carts = new FakeCartRepository();
        var user = CartOwner.ForUser("user-1");
        var service = Build(carts, product);

        await service.AddAsync(user, new AddToCartRequest(product.Id, 80), default);
        await service.AddAsync(Anonymous, new AddToCartRequest(product.Id, 80), default);

        await service.MergeAsync("anon-1", "user-1", default);

        var line = Assert.Single((await service.GetAsync(user, default)).Lines);
        Assert.Equal(CartItem.MaxQuantityPerLine, line.Quantity);
    }

    [Fact]
    public async Task MergingWithNoAnonymousCartIsHarmless()
    {
        var carts = new FakeCartRepository();
        var service = Build(carts, Product());

        await service.MergeAsync("anon-unknown", "user-1", default);

        Assert.Empty(carts.Carts);
    }

    [Fact]
    public async Task MergingAnEmptyAnonymousCartRemovesIt()
    {
        var carts = new FakeCartRepository();
        carts.Carts.Add(new CartEntity { Id = "cart-1", AnonId = "anon-1" });
        var service = Build(carts, Product());

        await service.MergeAsync("anon-1", "user-1", default);

        Assert.Empty(carts.Carts);
    }
}
