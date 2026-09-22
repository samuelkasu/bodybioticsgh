using BodyBiotics.Domain.Entities;

namespace BodyBiotics.Infrastructure.Persistence;

/// <summary>
/// The tag archives the old WordPress site published, kept at the same URLs so
/// those links and their search rankings survive the rebuild. Seeded rather
/// than hard-coded in the frontend so the set can be edited in the database
/// without a deploy.
/// </summary>
internal static class ProductTagSeedData
{
    /// <summary>Korean houses stocked here, for the "Korean skincare" archive.</summary>
    private const string KoreanBrands =
        "abib,acwell,anua,aplb,celimax,cosrx,dr-althea,haruharu,jumiso,mary-may," +
        "medicube,mixsoon,nineless,numbuzin,purito,skin1004,some-by-mi,tiam";

    public static IReadOnlyList<ProductTag> All { get; } =
    [
        Tag("brightening-cleanser", "Brightening Cleanser",
            "Face washes that even out tone while they clean.",
            categorySlugs: "face-wash", search: "brightening", sortOrder: 0),
        Tag("face-wash", "Face Wash",
            "Every cleanser on the shelf, from gel to foam.",
            categorySlugs: "face-wash", sortOrder: 1),
        Tag("facial-cleanser", "Facial Cleanser",
            "Cleansers for the face — oils, balms, foams and gels.",
            search: "cleanser", sortOrder: 2),
        Tag("kojic-acid", "Kojic Acid",
            "Kojic acid soaps, serums and creams for dark spots.",
            search: "kojic", sortOrder: 3),
        Tag("korean-skincare", "Korean Skincare",
            "The Korean houses we stock, from Anua to Numbuzin.",
            brandSlugs: KoreanBrands, sortOrder: 4),
        Tag("medicube", "Medicube",
            "The full Medicube range in stock.",
            brandSlugs: "medicube", sortOrder: 5),
        Tag("skincare-ghana", "Skincare Ghana",
            "Authentic skincare, delivered anywhere in Ghana.",
            sortOrder: 6),
        Tag("turmeric", "Turmeric",
            "Turmeric soaps, scrubs and creams for a brighter finish.",
            search: "turmeric", sortOrder: 7),
    ];

    // Id is filled in by the seeder, which knows whether the row is new.
    private static ProductTag Tag(
        string slug,
        string name,
        string intro,
        string? categorySlugs = null,
        string? brandSlugs = null,
        string? search = null,
        int sortOrder = 0) => new()
        {
            Id = string.Empty,
            Slug = slug,
            Name = name,
            Intro = intro,
            CategorySlugs = categorySlugs,
            BrandSlugs = brandSlugs,
            Search = search,
            SortOrder = sortOrder,
        };
}
