using System.Security.Claims;
using BodyBiotics.Api.Http;
using Microsoft.AspNetCore.Mvc;

namespace BodyBiotics.Api.Features.Reviews;

public static class ReviewEndpoints
{
    public static RouteGroupBuilder MapReviewEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/products/{slug}/reviews").WithTags("Reviews");

        group.MapGet("/", ListAsync).WithName("ListProductReviews");

        group.MapPost("/", SubmitAsync)
            .WithName("SubmitProductReview")
            .RequireAuthorization()
            // Multipart, so the form binds rather than the JSON body. Antiforgery
            // is off because the session cookie is SameSite=Lax and the API has
            // no HTML forms of its own to protect.
            .DisableAntiforgery()
            .RequireRateLimiting(RateLimitPolicies.Auth);

        group.MapDelete("/", DeleteAsync)
            .WithName("DeleteProductReview")
            .RequireAuthorization();

        return api;
    }

    private static async Task<IResult> ListAsync(
        string slug,
        HttpContext httpContext,
        ReviewService reviews,
        CancellationToken cancellationToken)
    {
        var result = await reviews.ListAsync(slug, CurrentUserId(httpContext), cancellationToken);

        // Private: the payload marks the caller's own review.
        CacheHeaders.Private(httpContext.Response);
        return ApiResults.Ok(result);
    }

    // [FromForm] on each field rather than the whole record: minimal APIs bind
    // an unattributed simple parameter from the query string, which would leave
    // the rating at zero however the form was filled in.
    private static async Task<IResult> SubmitAsync(
        string slug,
        [FromForm] int rating,
        [FromForm] string? comment,
        [FromForm] IFormFile? photo,
        [FromForm] bool? removePhoto,
        HttpContext httpContext,
        ReviewService reviews,
        CancellationToken cancellationToken)
    {
        var userId = CurrentUserId(httpContext)
            ?? throw new ApiException(ApiErrorCode.Unauthorized, "Sign in required");

        var review = await reviews.SubmitAsync(
            slug,
            userId,
            new CreateReviewRequest(rating, comment ?? string.Empty),
            photo,
            removePhoto ?? false,
            cancellationToken);

        CacheHeaders.Private(httpContext.Response);
        return ApiResults.Ok(review);
    }

    private static async Task<IResult> DeleteAsync(
        string slug,
        HttpContext httpContext,
        ReviewService reviews,
        CancellationToken cancellationToken)
    {
        var userId = CurrentUserId(httpContext)
            ?? throw new ApiException(ApiErrorCode.Unauthorized, "Sign in required");

        await reviews.DeleteAsync(slug, userId, cancellationToken);

        CacheHeaders.Private(httpContext.Response);
        return ApiResults.Ok(new { removed = true });
    }

    private static string? CurrentUserId(HttpContext httpContext) =>
        httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier);
}
