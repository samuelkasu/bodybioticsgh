using BodyBiotics.Api.Features.Products;
using BodyBiotics.Api.Http;
using BodyBiotics.Domain.Abstractions;
using BodyBiotics.Domain.Entities;
using BodyBiotics.Tests.Fakes;

namespace BodyBiotics.Tests.Api;

public class CatalogueServiceTests
{
    private static readonly Category Serums = new() { Id = "c1", Slug = "face-serum", Name = "Face Serum" };
    private static readonly Brand Anua = new() { Id = "b1", Slug = "anua", Name = "Anua" };

    private static readonly ProductTag KoreanSkincare = new()
    {
        Id = "t1",
        Slug = "korean-skincare",
        Name = "Korean Skincare",
        Intro = "The Korean houses we stock.",
        BrandSlugs = "anua,cosrx",
    };

    private static Product Product(
        string id,
        string name,
        int priceMinor,
        Category? category = null,
        Brand? brand = null,
        bool active = true) => new()
        {
            Id = id,
            Slug = $"product-{id}",
            Name = name,
            Description = "Test product",
            PriceMinor = priceMinor,
            ImageUrl = "/catalog/test/main.webp",
            Stock = 5,
            Active = active,
            CategoryId = category?.Id,
            Category = category,
            BrandId = brand?.Id,
            Brand = brand,
        };

    private static CatalogueService Build(params Product[] products) =>
        Build(new FakePromotionRepository(), products);

    private static CatalogueService Build(
        FakePromotionRepository promotions,
        params Product[] products) =>
        new(new FakeProductRepository(products),
            new StubCategoryRepository(),
            new StubBrandRepository(),
            new StubProductTagRepository(),
            promotions,
            new ProductListRequestValidator());

    [Fact]
    public async Task ListsActiveProductsOnly()
    {
        var service = Build(
            Product("a", "Glow Serum", 12_500),
            Product("b", "Hidden", 9_900, active: false));

        var page = await service.ListAsync(new ProductListRequest(), default);

        Assert.Equal(1, page.Total);
        Assert.Equal("Glow Serum", page.Items[0].Name);
    }

    [Fact]
    public async Task PagesTheResults()
    {
        var service = Build(
            [.. Enumerable.Range(1, 30).Select(index => Product($"p{index}", $"Product {index}", 1_000))]);

        var page = await service.ListAsync(new ProductListRequest(Page: 2, PerPage: 12), default);

        Assert.Equal(12, page.Items.Count);
        Assert.Equal(30, page.Total);
        Assert.Equal(2, page.Page);
    }

    [Fact]
    public async Task SortsByPrice()
    {
        var service = Build(
            Product("a", "Expensive", 34_000),
            Product("b", "Cheap", 8_000));

        var ascending = await service.ListAsync(new ProductListRequest(Sort: "price-asc"), default);
        var descending = await service.ListAsync(new ProductListRequest(Sort: "price-desc"), default);

        Assert.Equal("Cheap", ascending.Items[0].Name);
        Assert.Equal("Expensive", descending.Items[0].Name);
    }

    [Fact]
    public async Task FiltersByCategoryBrandAndPrice()
    {
        var service = Build(
            Product("a", "Anua Serum", 20_000, Serums, Anua),
            Product("b", "Other Serum", 50_000, Serums),
            Product("c", "Unrelated", 1_000));

        var byCategory = await service.ListAsync(new ProductListRequest(Category: "face-serum"), default);
        var byBrand = await service.ListAsync(new ProductListRequest(Brand: "anua"), default);
        var byPrice = await service.ListAsync(
            new ProductListRequest(MinPrice: 10_000, MaxPrice: 30_000),
            default);

        Assert.Equal(2, byCategory.Total);
        Assert.Equal("Anua Serum", Assert.Single(byBrand.Items).Name);
        Assert.Equal("Anua Serum", Assert.Single(byPrice.Items).Name);
    }

    [Fact]
    public async Task SearchIsCaseInsensitive()
    {
        var service = Build(Product("a", "Glow Serum", 12_500));

        var page = await service.ListAsync(new ProductListRequest(Search: "glow"), default);

        Assert.Single(page.Items);
    }

    [Theory]
    [InlineData(0, 12, null)]
    [InlineData(1, 0, null)]
    [InlineData(1, 49, null)]
    [InlineData(1, 12, "random")]
    public async Task RejectsAnInvalidListRequest(int page, int perPage, string? sort)
    {
        var service = Build(Product("a", "Glow Serum", 12_500));

        await Assert.ThrowsAsync<FluentValidation.ValidationException>(() =>
            service.ListAsync(new ProductListRequest(page, perPage, Sort: sort), default));
    }

    [Fact]
    public async Task RejectsAPriceRangeThatIsInverted()
    {
        var service = Build(Product("a", "Glow Serum", 12_500));

        await Assert.ThrowsAsync<FluentValidation.ValidationException>(() =>
            service.ListAsync(new ProductListRequest(MinPrice: 5_000, MaxPrice: 1_000), default));
    }

    [Fact]
    public async Task ProductDetailIncludesCategoryBrandAndRelated()
    {
        var service = Build(
            Product("a", "Anua Serum", 20_000, Serums, Anua),
            Product("b", "Another Serum", 15_000, Serums));

        var detail = await service.GetBySlugAsync("product-a", default);

        Assert.Equal("Face Serum", detail.Product.CategoryName);
        Assert.Equal("anua", detail.Product.BrandSlug);
        Assert.Equal("Another Serum", Assert.Single(detail.Related).Name);
    }

    [Fact]
    public async Task RelatedExcludesTheProductItself()
    {
        var service = Build(Product("a", "Only Serum", 20_000, Serums));

        var detail = await service.GetBySlugAsync("product-a", default);

        Assert.Empty(detail.Related);
    }

    [Fact]
    public async Task AnUnknownSlugIsANotFound()
    {
        var service = Build(Product("a", "Glow Serum", 12_500));

        var error = await Assert.ThrowsAsync<ApiException>(() =>
            service.GetBySlugAsync("ghost", default));

        Assert.Equal(ApiErrorCode.NotFound, error.Code);
    }

    [Fact]
    public async Task AnInactiveProductIsNotReachableBySlug()
    {
        var service = Build(Product("a", "Hidden", 12_500, active: false));

        await Assert.ThrowsAsync<ApiException>(() => service.GetBySlugAsync("product-a", default));
    }

    [Fact]
    public async Task AnUnknownArchiveSlugIsANotFound()
    {
        var service = Build(Product("a", "Glow Serum", 12_500));

        await Assert.ThrowsAsync<ApiException>(() => service.GetCategoryAsync("ghost", default));
        await Assert.ThrowsAsync<ApiException>(() => service.GetBrandAsync("ghost", default));
        await Assert.ThrowsAsync<ApiException>(() => service.GetTagAsync("ghost", default));
    }

    [Fact]
    public async Task ATagCarriesTheQueryItStandsFor()
    {
        var service = Build(Product("a", "Anua Serum", 20_000, Serums, Anua));

        var tag = await service.GetTagAsync("korean-skincare", default);

        Assert.Equal("Korean Skincare", tag.Name);
        Assert.Equal("anua,cosrx", tag.Query.Brand);
        Assert.Null(tag.Query.Category);
        Assert.Equal("korean-skincare", Assert.Single(await service.ListTagsAsync(default)).Slug);
    }

    private sealed class StubProductTagRepository : IProductTagRepository
    {
        public Task<IReadOnlyList<ProductTag>> ListAsync(CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<ProductTag>>([KoreanSkincare]);

        public Task<ProductTag?> FindBySlugAsync(string slug, CancellationToken cancellationToken) =>
            Task.FromResult(slug == KoreanSkincare.Slug ? KoreanSkincare : null);
    }

    private sealed class StubCategoryRepository : ICategoryRepository
    {
        public Task<IReadOnlyList<CategorySummary>> ListAsync(CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<CategorySummary>>(
                [new CategorySummary(Serums.Slug, Serums.Name, 2)]);

        public Task<Category?> FindBySlugAsync(string slug, CancellationToken cancellationToken) =>
            Task.FromResult(slug == Serums.Slug ? Serums : null);
    }

    private sealed class StubBrandRepository : IBrandRepository
    {
        public Task<IReadOnlyList<BrandSummary>> ListAsync(CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<BrandSummary>>([new BrandSummary(Anua.Slug, Anua.Name, 1)]);

        public Task<Brand?> FindBySlugAsync(string slug, CancellationToken cancellationToken) =>
            Task.FromResult(slug == Anua.Slug ? Anua : null);
    }
}
