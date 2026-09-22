namespace BodyBiotics.Domain.Entities;

public sealed class Category
{
    public required string Id { get; init; }
    public required string Slug { get; set; }
    public required string Name { get; set; }

    public ICollection<Product> Products { get; init; } = [];
}

public sealed class Brand
{
    public required string Id { get; init; }
    public required string Slug { get; set; }
    public required string Name { get; set; }

    public ICollection<Product> Products { get; init; } = [];
}

/// <summary>
/// One rendition of a product photo. The source catalogue gives a single
/// picture per product at several widths, so this doubles as the responsive
/// source set and as a gallery once richer photography exists.
/// </summary>
public sealed class ProductImage
{
    public required string Id { get; init; }
    public required string ProductId { get; init; }
    public Product? Product { get; init; }

    public required string Url { get; set; }
    public int Width { get; set; }
    public int SortOrder { get; set; }
}

public sealed class Product
{
    public required string Id { get; init; }
    public required string Slug { get; set; }
    public required string Name { get; set; }
    public required string Description { get; set; }

    /// <summary>Supplier stock-keeping unit, shown on the product page.</summary>
    public string? Sku { get; set; }

    /// <summary>
    /// Minor units (pesewas). Never decimal or double: totals, discounts and
    /// tax must not drift, and integers make that impossible by construction.
    ///
    /// This is the list price. What a customer is actually charged is
    /// <see cref="EffectivePriceMinor"/>, which a running sale lowers.
    /// </summary>
    public required int PriceMinor { get; set; }

    /// <summary>
    /// What the product costs while its sale is running. Null when there is no
    /// sale. Held apart from <see cref="PriceMinor"/> rather than overwriting
    /// it so a sale can end by itself — a shop that has to remember to put a
    /// price back is a shop that sells at the sale price for a month.
    /// </summary>
    public int? SalePriceMinor { get; set; }

    /// <summary>
    /// When the sale starts and stops. Null start means "already running",
    /// null end means "until someone stops it".
    /// </summary>
    public DateTimeOffset? SaleStartsAt { get; set; }

    public DateTimeOffset? SaleEndsAt { get; set; }

    public string Currency { get; set; } = "GHS";

    /// <summary>Primary image, denormalised so a product card needs no join.</summary>
    public required string ImageUrl { get; set; }

    /// <summary>
    /// Second photo, shown while a catalogue card is hovered. Null for the
    /// products the source catalogue only ever gave one picture.
    /// </summary>
    public string? HoverImageUrl { get; set; }

    public int Stock { get; set; }
    public bool Active { get; set; } = true;

    public string? CategoryId { get; set; }
    public Category? Category { get; set; }

    public string? BrandId { get; set; }
    public Brand? Brand { get; set; }

    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<ProductImage> Images { get; init; } = [];
    public ICollection<ProductReview> Reviews { get; init; } = [];
    public ICollection<CartItem> CartItems { get; init; } = [];
    public ICollection<OrderItem> OrderItems { get; init; } = [];

    public bool InStock => Stock > 0;

    /// <summary>
    /// Whether the sale is running right now. A sale price that is not below
    /// the list price is not a sale, and showing "was GH₵50, now GH₵50" is how
    /// a shop loses the benefit of the doubt.
    /// </summary>
    public bool IsOnSale(DateTimeOffset now) =>
        SalePriceMinor is { } sale
        && sale >= 0
        && sale < PriceMinor
        && (SaleStartsAt is null || SaleStartsAt <= now)
        && (SaleEndsAt is null || SaleEndsAt > now);

    /// <summary>
    /// What this product costs today. Every price the customer is shown or
    /// charged comes from here; nothing reads <see cref="PriceMinor"/> to
    /// charge with.
    /// </summary>
    public int EffectivePriceMinor(DateTimeOffset now) =>
        IsOnSale(now) ? SalePriceMinor!.Value : PriceMinor;

    /// <summary>The struck-through "was" price, or null when nothing is struck through.</summary>
    public int? CompareAtPriceMinor(DateTimeOffset now) =>
        IsOnSale(now) ? PriceMinor : null;

    public bool CanFulfil(int quantity) => Active && quantity > 0 && Stock >= quantity;

    /// <summary>
    /// Reserves stock at checkout. Returns false rather than throwing so the
    /// caller can report which line failed instead of aborting the order.
    /// </summary>
    public bool TryReserve(int quantity)
    {
        if (!CanFulfil(quantity))
        {
            return false;
        }

        Stock -= quantity;
        UpdatedAt = DateTimeOffset.UtcNow;
        return true;
    }

    /// <summary>
    /// Puts reserved stock back when an order is cancelled. Checkout takes the
    /// stock at the moment the order is placed, so without this a cancelled
    /// order keeps its items out of the catalogue permanently.
    /// </summary>
    public void Release(int quantity)
    {
        if (quantity <= 0)
        {
            return;
        }

        Stock += quantity;
        UpdatedAt = DateTimeOffset.UtcNow;
    }
}
