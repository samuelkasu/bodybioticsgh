namespace BodyBiotics.Domain.Entities;

/// <summary>
/// A tag archive: a named, linkable saved search over the catalogue.
///
/// WooCommerce held a real tag-to-product mapping, and the export never
/// captured it, so a tag is stored as the filters that reproduce its archive
/// rather than as a join table. Slugs match the old site's URLs.
/// </summary>
public sealed class ProductTag
{
    public required string Id { get; init; }
    public required string Slug { get; set; }
    public required string Name { get; set; }

    /// <summary>Line under the archive banner.</summary>
    public required string Intro { get; set; }

    /// <summary>Comma-separated category slugs; null when the tag does not narrow by category.</summary>
    public string? CategorySlugs { get; set; }

    /// <summary>Comma-separated brand slugs, so "korean skincare" can be several houses.</summary>
    public string? BrandSlugs { get; set; }

    /// <summary>Free-text term matched against product names.</summary>
    public string? Search { get; set; }

    /// <summary>Position in the tag list; ties fall back to name.</summary>
    public int SortOrder { get; set; }

    public bool Active { get; set; } = true;
}
