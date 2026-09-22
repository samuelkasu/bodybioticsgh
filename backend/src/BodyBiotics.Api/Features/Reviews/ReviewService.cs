using BodyBiotics.Api.Http;
using BodyBiotics.Domain.Common;
using BodyBiotics.Domain.Entities;
using BodyBiotics.Infrastructure.Persistence;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace BodyBiotics.Api.Features.Reviews;

public sealed class ReviewService(
    AppDbContext db,
    ReviewPhotoStore photos,
    IValidator<CreateReviewRequest> validator)
{
    public async Task<ReviewListDto> ListAsync(
        string slug,
        string? currentUserId,
        CancellationToken cancellationToken)
    {
        var productId = await ResolveProductIdAsync(slug, cancellationToken);

        var reviews = await db.ProductReviews
            .AsNoTracking()
            .Where(review => review.ProductId == productId)
            .OrderByDescending(review => review.CreatedAt)
            .ToListAsync(cancellationToken);

        return new ReviewListDto(Summarise(reviews), [.. reviews.Select(review => ReviewDto.From(review, currentUserId))]);
    }

    /// <summary>
    /// Writes the customer's review, or replaces the one they already left —
    /// the unique index makes a second row impossible, and silently failing
    /// would read as the form being broken.
    /// </summary>
    public async Task<ReviewDto> SubmitAsync(
        string slug,
        string userId,
        CreateReviewRequest request,
        IFormFile? photo,
        bool removePhoto,
        CancellationToken cancellationToken)
    {
        await validator.ValidateAndThrowAsync(request, cancellationToken);

        var productId = await ResolveProductIdAsync(slug, cancellationToken);

        var user = await db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(candidate => candidate.Id == userId, cancellationToken)
            ?? throw new ApiException(ApiErrorCode.Unauthorized, "Sign in required");

        var existing = await db.ProductReviews.FirstOrDefaultAsync(
            review => review.ProductId == productId && review.UserId == userId,
            cancellationToken);

        var photoUrl = photo is null ? null : await photos.SaveAsync(photo, cancellationToken);
        var authorName = DisplayName(user);

        if (existing is null)
        {
            existing = new ProductReview
            {
                Id = Identifier.New(),
                ProductId = productId,
                UserId = userId,
                AuthorName = authorName,
                Rating = request.Rating,
                Comment = request.Comment.Trim(),
                PhotoUrl = photoUrl,
            };

            db.ProductReviews.Add(existing);
        }
        else
        {
            var previousPhoto = existing.PhotoUrl;

            existing.AuthorName = authorName;
            existing.Rating = request.Rating;
            existing.Comment = request.Comment.Trim();

            if (photoUrl is not null)
            {
                existing.PhotoUrl = photoUrl;
                photos.Delete(previousPhoto);
            }
            else if (removePhoto)
            {
                existing.PhotoUrl = null;
                photos.Delete(previousPhoto);
            }
        }

        await db.SaveChangesAsync(cancellationToken);

        return ReviewDto.From(existing, userId);
    }

    public async Task DeleteAsync(string slug, string userId, CancellationToken cancellationToken)
    {
        var productId = await ResolveProductIdAsync(slug, cancellationToken);

        var review = await db.ProductReviews.FirstOrDefaultAsync(
            candidate => candidate.ProductId == productId && candidate.UserId == userId,
            cancellationToken)
            ?? throw new ApiException(ApiErrorCode.NotFound, "You have not reviewed this product.");

        db.ProductReviews.Remove(review);
        await db.SaveChangesAsync(cancellationToken);

        photos.Delete(review.PhotoUrl);
    }

    private async Task<string> ResolveProductIdAsync(string slug, CancellationToken cancellationToken)
    {
        var productId = await db.Products
            .AsNoTracking()
            .Where(product => product.Slug == slug && product.Active)
            .Select(product => product.Id)
            .FirstOrDefaultAsync(cancellationToken);

        return productId ?? throw new ApiException(ApiErrorCode.NotFound, "Product not found");
    }

    private static ReviewSummaryDto Summarise(List<ProductReview> reviews)
    {
        var distribution = Enumerable
            .Range(ProductReview.MinRating, ProductReview.MaxRating)
            .ToDictionary(star => star, star => reviews.Count(review => review.Rating == star));

        // One decimal place: "4.7", the way the storefront prints it.
        var average = reviews.Count == 0
            ? 0
            : Math.Round(reviews.Average(review => review.Rating), 1);

        return new ReviewSummaryDto(average, reviews.Count, distribution);
    }

    /// <summary>
    /// Falls back to the part of the email before the @, never the whole
    /// address: a review byline is public, and an address there is an invitation
    /// to spam the customer.
    /// </summary>
    private static string DisplayName(User user)
    {
        if (!string.IsNullOrWhiteSpace(user.Name))
        {
            return user.Name.Trim();
        }

        var local = user.Email.Split('@')[0];
        return string.IsNullOrWhiteSpace(local) ? "Customer" : local;
    }
}
