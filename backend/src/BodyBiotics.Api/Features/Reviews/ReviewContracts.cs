using BodyBiotics.Domain.Entities;
using FluentValidation;

namespace BodyBiotics.Api.Features.Reviews;

public sealed record ReviewDto(
    string Id,
    string AuthorName,
    int Rating,
    string Comment,
    string? PhotoUrl,
    DateTimeOffset CreatedAt,
    /// <summary>True on the signed-in customer's own review, so the UI can offer an edit.</summary>
    bool IsMine)
{
    public static ReviewDto From(ProductReview review, string? currentUserId) => new(
        review.Id,
        review.AuthorName,
        review.Rating,
        review.Comment,
        review.PhotoUrl,
        review.CreatedAt,
        currentUserId is not null && review.UserId == currentUserId);
}

/// <summary>
/// Header for the reviews block: the average, how many there are, and how the
/// ratings are spread, so the page can draw the five bars without a second call.
/// </summary>
public sealed record ReviewSummaryDto(
    double Average,
    int Count,
    IReadOnlyDictionary<int, int> Distribution);

public sealed record ReviewListDto(ReviewSummaryDto Summary, IReadOnlyList<ReviewDto> Items);

public sealed record CreateReviewRequest(int Rating, string Comment);

public sealed class CreateReviewRequestValidator : AbstractValidator<CreateReviewRequest>
{
    public CreateReviewRequestValidator()
    {
        RuleFor(request => request.Rating)
            .InclusiveBetween(ProductReview.MinRating, ProductReview.MaxRating);
        RuleFor(request => request.Comment).NotEmpty().MinimumLength(10).MaximumLength(2000);
    }
}
