using System.Text.Json;
using System.Text.Json.Serialization;

namespace BodyBiotics.Infrastructure.Persistence;

/// <summary>
/// Shape of <c>backend/seed/catalog.json</c>, produced once by
/// <c>frontend/scripts/import-catalog.ts</c> from the old WordPress site.
/// </summary>
public sealed record CatalogSeedFile(
    [property: JsonPropertyName("categories")] IReadOnlyList<CatalogTerm> Categories,
    [property: JsonPropertyName("brands")] IReadOnlyList<CatalogTerm> Brands,
    [property: JsonPropertyName("products")] IReadOnlyList<CatalogSeedProduct> Products)
{
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);

    /// <summary>
    /// Looks for the seed file next to the solution. Returns null when it is
    /// absent so a deployment without the file still boots — it just seeds
    /// nothing rather than crashing on start.
    /// </summary>
    public static async Task<CatalogSeedFile?> LoadAsync(
        string contentRoot,
        CancellationToken cancellationToken)
    {
        var candidates = new[]
        {
            Path.Combine(contentRoot, "seed", "catalog.json"),
            Path.Combine(contentRoot, "..", "..", "seed", "catalog.json"),
            Path.Combine(AppContext.BaseDirectory, "seed", "catalog.json"),
        };

        var file = candidates.FirstOrDefault(File.Exists);
        if (file is null)
        {
            return null;
        }

        await using var stream = File.OpenRead(file);
        return await JsonSerializer.DeserializeAsync<CatalogSeedFile>(
            stream,
            Options,
            cancellationToken);
    }
}

public sealed record CatalogTerm(
    [property: JsonPropertyName("slug")] string Slug,
    [property: JsonPropertyName("name")] string Name);

public sealed record CatalogSeedProduct(
    [property: JsonPropertyName("slug")] string Slug,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("sku")] string? Sku,
    [property: JsonPropertyName("description")] string Description,
    [property: JsonPropertyName("priceMinor")] int PriceMinor,
    [property: JsonPropertyName("currency")] string Currency,
    [property: JsonPropertyName("stock")] int Stock,
    [property: JsonPropertyName("active")] bool Active,
    [property: JsonPropertyName("categorySlug")] string? CategorySlug,
    [property: JsonPropertyName("brandSlug")] string? BrandSlug,
    [property: JsonPropertyName("images")] IReadOnlyList<string> Images,
    [property: JsonPropertyName("hoverImage")] string? HoverImage = null);
