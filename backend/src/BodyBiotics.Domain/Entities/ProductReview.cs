namespace BodyBiotics.Domain.Entities;

/// <summary>
/// A customer's rating and comment on a product. Only signed-in customers can
/// write one, and only one per product each, so the average cannot be stuffed
/// by repeat submissions from the same account.
/// </summary>
public sealed class ProductReview
{
    public const int MinRating = 1;
    public const int MaxRating = 5;

    public required string Id { get; init; }

    public required string ProductId { get; init; }
    public Product? Product { get; init; }

    public required string UserId { get; init; }
    public User? User { get; init; }

    /// <summary>
    /// Copied at write time rather than read from the user. Renaming an account
    /// must not silently rewrite the byline on reviews other people have read.
    /// </summary>
    public required string AuthorName { get; set; }

    public required int Rating { get; set; }

    public required string Comment { get; set; }

    /// <summary>Optional photo the reviewer attached, served from /uploads.</summary>
    public string? PhotoUrl { get; set; }

    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
