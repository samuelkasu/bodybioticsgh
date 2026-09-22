using BodyBiotics.Domain.Common;
using BodyBiotics.Domain.Entities;
using BodyBiotics.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BodyBiotics.Infrastructure.Persistence;

/// <summary>
/// Idempotent: safe to run on every deploy and against a shared staging
/// database. Seeds the catalogue imported from the previous site, plus one
/// admin account.
/// </summary>
public sealed partial class DatabaseSeeder(
    AppDbContext db,
    IPasswordHasher passwordHasher,
    ILogger<DatabaseSeeder> logger)
{
    public async Task SeedAsync(
        string contentRoot,
        string adminEmail,
        string adminPassword,
        CancellationToken cancellationToken = default)
    {
        await SeedAdminAsync(adminEmail, adminPassword, cancellationToken);
        // Independent of catalog.json, so the tag archives exist even on a
        // deployment seeded without one.
        await SeedProductTagsAsync(cancellationToken);

        var catalog = await CatalogSeedFile.LoadAsync(contentRoot, cancellationToken);
        if (catalog is null)
        {
            LogNoCatalogue(logger, contentRoot);
            return;
        }

        var categories = await SeedTermsAsync(catalog.Categories, cancellationToken);
        var brands = await SeedBrandsAsync(catalog.Brands, cancellationToken);
        var products = await SeedProductsAsync(catalog, categories, brands, cancellationToken);

        LogSeedComplete(logger, categories.Count, brands.Count, products);
    }

    private async Task SeedAdminAsync(
        string adminEmail,
        string adminPassword,
        CancellationToken cancellationToken)
    {
        if (await db.Users.AnyAsync(user => user.Email == adminEmail, cancellationToken))
        {
            return;
        }

        db.Users.Add(new User
        {
            Id = Identifier.New(),
            Email = adminEmail,
            Name = "Store admin",
            Role = UserRole.Admin,
            PasswordHash = passwordHasher.Hash(adminPassword),
        });

        await db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Inserts the tags that are missing and leaves the rest untouched: unlike
    /// categories, a tag's copy and filters are meant to be edited in place,
    /// and a re-seed must not undo that.
    /// </summary>
    private async Task SeedProductTagsAsync(CancellationToken cancellationToken)
    {
        var existing = await db.ProductTags
            .Select(tag => tag.Slug)
            .ToListAsync(cancellationToken);

        var known = existing.ToHashSet();
        var added = 0;

        foreach (var seed in ProductTagSeedData.All.Where(tag => !known.Contains(tag.Slug)))
        {
            db.ProductTags.Add(new ProductTag
            {
                Id = Identifier.New(),
                Slug = seed.Slug,
                Name = seed.Name,
                Intro = seed.Intro,
                CategorySlugs = seed.CategorySlugs,
                BrandSlugs = seed.BrandSlugs,
                Search = seed.Search,
                SortOrder = seed.SortOrder,
            });

            added++;
        }

        if (added == 0)
        {
            return;
        }

        await db.SaveChangesAsync(cancellationToken);
        LogTagsSeeded(logger, added);
    }

    private async Task<Dictionary<string, string>> SeedTermsAsync(
        IReadOnlyList<CatalogTerm> terms,
        CancellationToken cancellationToken)
    {
        var existing = await db.Categories.ToDictionaryAsync(
            category => category.Slug,
            cancellationToken);

        foreach (var term in terms)
        {
            if (existing.TryGetValue(term.Slug, out var category))
            {
                category.Name = term.Name;
                continue;
            }

            var created = new Category
            {
                Id = Identifier.New(),
                Slug = term.Slug,
                Name = term.Name,
            };

            db.Categories.Add(created);
            existing[term.Slug] = created;
        }

        await db.SaveChangesAsync(cancellationToken);
        return existing.ToDictionary(pair => pair.Key, pair => pair.Value.Id);
    }

    private async Task<Dictionary<string, string>> SeedBrandsAsync(
        IReadOnlyList<CatalogTerm> terms,
        CancellationToken cancellationToken)
    {
        var existing = await db.Brands.ToDictionaryAsync(brand => brand.Slug, cancellationToken);

        foreach (var term in terms)
        {
            if (existing.TryGetValue(term.Slug, out var brand))
            {
                brand.Name = term.Name;
                continue;
            }

            var created = new Brand
            {
                Id = Identifier.New(),
                Slug = term.Slug,
                Name = term.Name,
            };

            db.Brands.Add(created);
            existing[term.Slug] = created;
        }

        await db.SaveChangesAsync(cancellationToken);
        return existing.ToDictionary(pair => pair.Key, pair => pair.Value.Id);
    }

    private async Task<int> SeedProductsAsync(
        CatalogSeedFile catalog,
        IReadOnlyDictionary<string, string> categories,
        IReadOnlyDictionary<string, string> brands,
        CancellationToken cancellationToken)
    {
        var existing = await db.Products
            .Include(product => product.Images)
            .ToDictionaryAsync(product => product.Slug, cancellationToken);

        foreach (var seed in catalog.Products)
        {
            var categoryId = seed.CategorySlug is null
                ? null
                : categories.GetValueOrDefault(seed.CategorySlug);
            var brandId = seed.BrandSlug is null ? null : brands.GetValueOrDefault(seed.BrandSlug);
            var primaryImage = seed.Images.Count > 0 ? seed.Images[0] : "/icons/icon-512.png";

            if (existing.TryGetValue(seed.Slug, out var product))
            {
                product.Name = seed.Name;
                product.Description = seed.Description;
                product.Sku = seed.Sku;
                product.PriceMinor = seed.PriceMinor;
                product.Currency = seed.Currency;
                product.ImageUrl = primaryImage;
                product.HoverImageUrl = seed.HoverImage;
                product.Active = seed.Active;
                product.CategoryId = categoryId;
                product.BrandId = brandId;
                // Stock is live trading data; re-seeding must not reset it.
                SyncImages(product, seed.Images);
                continue;
            }

            var created = new Product
            {
                Id = Identifier.New(),
                Slug = seed.Slug,
                Name = seed.Name,
                Description = seed.Description,
                Sku = seed.Sku,
                PriceMinor = seed.PriceMinor,
                Currency = seed.Currency,
                ImageUrl = primaryImage,
                HoverImageUrl = seed.HoverImage,
                Stock = seed.Stock,
                Active = seed.Active,
                CategoryId = categoryId,
                BrandId = brandId,
            };

            db.Products.Add(created);
            SyncImages(created, seed.Images);
        }

        // Anything the seed file no longer lists is withdrawn rather than
        // deleted: a corrected import must not orphan rows that existing
        // orders still reference.
        var seeded = catalog.Products.Select(product => product.Slug).ToHashSet();

        foreach (var (slug, product) in existing)
        {
            if (!seeded.Contains(slug) && product.Active)
            {
                product.Active = false;
                LogWithdrawn(logger, slug);
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        return catalog.Products.Count;
    }

    /// <summary>
    /// Renditions are derived from the source photo, so replacing them wholesale
    /// is correct and keeps the seed file the single source of truth.
    /// </summary>
    private void SyncImages(Product product, IReadOnlyList<string> urls)
    {
        if (product.Images.Count > 0)
        {
            db.ProductImages.RemoveRange(product.Images);
            product.Images.Clear();
        }

        for (var index = 0; index < urls.Count; index++)
        {
            product.Images.Add(new ProductImage
            {
                Id = Identifier.New(),
                ProductId = product.Id,
                Url = urls[index],
                Width = WidthFromUrl(urls[index]),
                SortOrder = index,
            });
        }
    }

    private static int WidthFromUrl(string url) =>
        int.TryParse(Path.GetFileNameWithoutExtension(url), out var width) ? width : 1200;

    [LoggerMessage(
        Level = LogLevel.Information,
        Message = "Seed complete: {Categories} categories, {Brands} brands, {Products} products")]
    private static partial void LogSeedComplete(
        ILogger logger,
        int categories,
        int brands,
        int products);

    [LoggerMessage(Level = LogLevel.Information, Message = "Seeded {Tags} product tags")]
    private static partial void LogTagsSeeded(ILogger logger, int tags);

    [LoggerMessage(
        Level = LogLevel.Information,
        Message = "Withdrew {Slug}: no longer present in the seed catalogue")]
    private static partial void LogWithdrawn(ILogger logger, string slug);

    [LoggerMessage(
        Level = LogLevel.Warning,
        Message = "No catalog.json found under {ContentRoot}; catalogue not seeded")]
    private static partial void LogNoCatalogue(ILogger logger, string contentRoot);
}
