using BodyBiotics.Domain.Abstractions;
using BodyBiotics.Domain.Entities;
using BodyBiotics.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BodyBiotics.Infrastructure.Repositories;

public sealed class ProductRepository(AppDbContext db) : IProductRepository
{
    public async Task<PagedResult<Product>> SearchAsync(
        ProductQuery query,
        CancellationToken cancellationToken)
    {
        var products = db.Products
            .AsNoTracking()
            .Include(product => product.Category)
            .Include(product => product.Brand)
            .Where(product => product.Active);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            // ILike maps to Postgres ILIKE and can use a trigram index as the
            // catalogue grows; ToLower().Contains() cannot.
            products = products.Where(product =>
                EF.Functions.ILike(product.Name, $"%{query.Search}%"));
        }

        if (!string.IsNullOrWhiteSpace(query.CategorySlug))
        {
            // The storefront can tick several categories, sending them as one
            // comma-separated value; any of them matches.
            var categorySlugs = query.CategorySlug
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

            if (categorySlugs.Length == 1)
            {
                products = products.Where(product =>
                    product.Category != null && product.Category.Slug == categorySlugs[0]);
            }
            else if (categorySlugs.Length > 1)
            {
                products = products.Where(product =>
                    product.Category != null && categorySlugs.Contains(product.Category.Slug));
            }
        }

        if (!string.IsNullOrWhiteSpace(query.BrandSlug))
        {
            // Comma-separated, like the category filter: a tag archive such as
            // "korean skincare" is several brands at once.
            var brandSlugs = query.BrandSlug
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

            if (brandSlugs.Length == 1)
            {
                products = products.Where(product =>
                    product.Brand != null && product.Brand.Slug == brandSlugs[0]);
            }
            else if (brandSlugs.Length > 1)
            {
                products = products.Where(product =>
                    product.Brand != null && brandSlugs.Contains(product.Brand.Slug));
            }
        }

        if (!string.IsNullOrWhiteSpace(query.Letter))
        {
            products = products.Where(product =>
                EF.Functions.ILike(product.Name, $"{query.Letter}%"));
        }

        if (query.MinPriceMinor is { } min)
        {
            products = products.Where(product => product.PriceMinor >= min);
        }

        if (query.MaxPriceMinor is { } max)
        {
            products = products.Where(product => product.PriceMinor <= max);
        }

        var total = await products.CountAsync(cancellationToken);

        products = query.Sort switch
        {
            ProductSort.PriceAscending => products.OrderBy(product => product.PriceMinor),
            ProductSort.PriceDescending => products.OrderByDescending(product => product.PriceMinor),
            ProductSort.Alphabetical => products.OrderBy(product => product.Name),
            // Ties broken by id so paging cannot show the same row twice.
            _ => products.OrderByDescending(product => product.CreatedAt).ThenBy(product => product.Id),
        };

        var items = await products
            .Skip(query.Skip)
            .Take(query.PerPage)
            .ToListAsync(cancellationToken);

        return new PagedResult<Product>(items, query.Page, query.PerPage, total);
    }

    public async Task<Product?> FindBySlugAsync(string slug, CancellationToken cancellationToken) =>
        await db.Products
            .AsNoTracking()
            .Include(product => product.Category)
            .Include(product => product.Brand)
            .Include(product => product.Images.OrderBy(image => image.SortOrder))
            .FirstOrDefaultAsync(
                product => product.Slug == slug && product.Active,
                cancellationToken);

    public async Task<IReadOnlyList<Product>> FindRelatedAsync(
        Product product,
        int take,
        CancellationToken cancellationToken) =>
        await db.Products
            .AsNoTracking()
            // Category and brand come along so a scoped campaign prices these
            // cards the same way it prices the grid they were clicked from.
            .Include(candidate => candidate.Category)
            .Include(candidate => candidate.Brand)
            .Where(candidate =>
                candidate.Active &&
                candidate.Id != product.Id &&
                candidate.CategoryId != null &&
                candidate.CategoryId == product.CategoryId)
            .OrderByDescending(candidate => candidate.CreatedAt)
            .Take(take)
            .ToListAsync(cancellationToken);

    /// <summary>
    /// One round trip for both bounds. An empty catalogue answers 0–0 rather
    /// than throwing, so the storefront's slider still renders.
    /// </summary>
    public async Task<PriceRange> GetPriceRangeAsync(CancellationToken cancellationToken)
    {
        var bounds = await db.Products
            .AsNoTracking()
            .Where(product => product.Active)
            .GroupBy(_ => 1)
            .Select(group => new
            {
                Min = group.Min(product => product.PriceMinor),
                Max = group.Max(product => product.PriceMinor),
            })
            .FirstOrDefaultAsync(cancellationToken);

        return bounds is null ? new PriceRange(0, 0) : new PriceRange(bounds.Min, bounds.Max);
    }

    /// <summary>
    /// Tracked on purpose: checkout reserves stock on these rows. Category and
    /// brand are included because checkout re-prices the basket against scoped
    /// campaigns before it charges anything.
    /// </summary>
    public async Task<IReadOnlyList<Product>> FindByIdsAsync(
        IReadOnlyCollection<string> ids,
        CancellationToken cancellationToken) =>
        ids.Count == 0
            ? []
            : await db.Products
                .Include(product => product.Category)
                .Include(product => product.Brand)
                .Where(product => ids.Contains(product.Id))
                .ToListAsync(cancellationToken);
}

public sealed class CategoryRepository(AppDbContext db) : ICategoryRepository
{
    public async Task<IReadOnlyList<CategorySummary>> ListAsync(CancellationToken cancellationToken) =>
        await db.Categories
            .AsNoTracking()
            // Filter before projecting: EF cannot translate a Where over a
            // constructor-projected record's property and throws at runtime.
            // Empty categories are noise in a filter list anyway.
            .Where(category => category.Products.Any(product => product.Active))
            .OrderBy(category => category.Name)
            .Select(category => new CategorySummary(
                category.Slug,
                category.Name,
                category.Products.Count(product => product.Active)))
            .ToListAsync(cancellationToken);

    public async Task<Category?> FindBySlugAsync(string slug, CancellationToken cancellationToken) =>
        await db.Categories.AsNoTracking().FirstOrDefaultAsync(
            category => category.Slug == slug,
            cancellationToken);
}

public sealed class ProductTagRepository(AppDbContext db) : IProductTagRepository
{
    public async Task<IReadOnlyList<ProductTag>> ListAsync(CancellationToken cancellationToken) =>
        await db.ProductTags
            .AsNoTracking()
            .Where(tag => tag.Active)
            .OrderBy(tag => tag.SortOrder)
            .ThenBy(tag => tag.Name)
            .ToListAsync(cancellationToken);

    public async Task<ProductTag?> FindBySlugAsync(string slug, CancellationToken cancellationToken) =>
        await db.ProductTags.AsNoTracking().FirstOrDefaultAsync(
            tag => tag.Slug == slug && tag.Active,
            cancellationToken);
}

public sealed class BrandRepository(AppDbContext db) : IBrandRepository
{
    public async Task<IReadOnlyList<BrandSummary>> ListAsync(CancellationToken cancellationToken) =>
        await db.Brands
            .AsNoTracking()
            .Where(brand => brand.Products.Any(product => product.Active))
            .OrderBy(brand => brand.Name)
            .Select(brand => new BrandSummary(
                brand.Slug,
                brand.Name,
                brand.Products.Count(product => product.Active)))
            .ToListAsync(cancellationToken);

    public async Task<Brand?> FindBySlugAsync(string slug, CancellationToken cancellationToken) =>
        await db.Brands.AsNoTracking().FirstOrDefaultAsync(
            brand => brand.Slug == slug,
            cancellationToken);
}
