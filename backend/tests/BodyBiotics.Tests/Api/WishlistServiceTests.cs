using BodyBiotics.Api.Features.Wishlist;
using BodyBiotics.Api.Http;
using BodyBiotics.Domain.Abstractions;
using BodyBiotics.Domain.Entities;
using BodyBiotics.Tests.Fakes;

namespace BodyBiotics.Tests.Api;

public class WishlistServiceTests
{
    private static readonly CartOwner Guest = CartOwner.ForAnonymous("anon-1");

    private static Product Product(string id, string name) => new()
    {
        Id = id,
        Slug = id,
        Name = name,
        Description = string.Empty,
        PriceMinor = 12_500,
        Stock = 5,
        Active = true,
        ImageUrl = $"/catalog/{id}/main.webp",
    };

    private static (WishlistService Service, FakeWishlistRepository Repository) Build(
        params Product[] products)
    {
        var repository = new FakeWishlistRepository(products);
        var service = new WishlistService(
            repository,
            new FakeProductRepository(products),
            new SaveToWishlistRequestValidator());

        return (service, repository);
    }

    [Fact]
    public async Task SavesAProductForAGuest()
    {
        var (service, _) = Build(Product("a", "Vitamin C Serum"));

        var result = await service.SaveAsync(Guest, new SaveToWishlistRequest("a"), default);

        Assert.Equal(1, result.Count);
        Assert.Equal("Vitamin C Serum", result.Items[0].Name);
    }

    [Fact]
    public async Task SavingTwiceIsNotAnError()
    {
        var (service, repository) = Build(Product("a", "Vitamin C Serum"));

        await service.SaveAsync(Guest, new SaveToWishlistRequest("a"), default);
        var result = await service.SaveAsync(Guest, new SaveToWishlistRequest("a"), default);

        // A double tap on a slow connection is the normal case, not a 409.
        Assert.Equal(1, result.Count);
        Assert.Single(repository.Items);
    }

    [Fact]
    public async Task RefusesToSaveAProductThatDoesNotExist()
    {
        var (service, _) = Build();

        await Assert.ThrowsAsync<ApiException>(() =>
            service.SaveAsync(Guest, new SaveToWishlistRequest("ghost"), default));
    }

    [Fact]
    public async Task RemovingSomethingNeverSavedIsNotAnError()
    {
        var (service, _) = Build(Product("a", "Vitamin C Serum"));

        var result = await service.RemoveAsync(Guest, "a", default);

        Assert.Equal(0, result.Count);
    }

    [Fact]
    public async Task RemovesASavedProduct()
    {
        var (service, _) = Build(Product("a", "Vitamin C Serum"), Product("b", "Shea Butter"));
        await service.SaveAsync(Guest, new SaveToWishlistRequest("a"), default);
        await service.SaveAsync(Guest, new SaveToWishlistRequest("b"), default);

        var result = await service.RemoveAsync(Guest, "a", default);

        Assert.Equal(1, result.Count);
        Assert.Equal("b", result.Items[0].Id);
    }

    [Fact]
    public async Task AVisitorWithNoCookieHasAnEmptyWishlist()
    {
        var (service, _) = Build(Product("a", "Vitamin C Serum"));

        // Reads must not mint an identity — that would hand a wishlist to every
        // crawler that walks the catalogue.
        var result = await service.ListAsync(CartOwner.ForAnonymous(string.Empty), default);

        Assert.Equal(0, result.Count);
    }

    [Fact]
    public async Task OneVisitorCannotSeeAnothersSavedItems()
    {
        var (service, _) = Build(Product("a", "Vitamin C Serum"));
        await service.SaveAsync(Guest, new SaveToWishlistRequest("a"), default);

        var other = await service.ListAsync(CartOwner.ForAnonymous("anon-2"), default);

        Assert.Equal(0, other.Count);
    }

    [Fact]
    public async Task SavedItemsFollowTheVisitorIntoTheirAccount()
    {
        var (service, _) = Build(Product("a", "Vitamin C Serum"));
        await service.SaveAsync(Guest, new SaveToWishlistRequest("a"), default);

        await service.MergeAsync("anon-1", "user-1", default);

        var account = await service.ListAsync(CartOwner.ForUser("user-1"), default);
        Assert.Equal(1, account.Count);
    }

    [Fact]
    public async Task MergingDoesNotDuplicateSomethingAlreadySaved()
    {
        var (service, repository) = Build(Product("a", "Vitamin C Serum"));
        await service.SaveAsync(CartOwner.ForUser("user-1"), new SaveToWishlistRequest("a"), default);
        await service.SaveAsync(Guest, new SaveToWishlistRequest("a"), default);

        await service.MergeAsync("anon-1", "user-1", default);

        var account = await service.ListAsync(CartOwner.ForUser("user-1"), default);
        Assert.Equal(1, account.Count);
        // The duplicate row is gone, not merely hidden by the query.
        Assert.Single(repository.Items);
    }
}
