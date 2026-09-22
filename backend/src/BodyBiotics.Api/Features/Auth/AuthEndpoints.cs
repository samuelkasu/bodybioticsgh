using BodyBiotics.Api.Auth;
using BodyBiotics.Api.Features.Cart;
using BodyBiotics.Api.Features.Wishlist;
using BodyBiotics.Api.Http;
using BodyBiotics.Domain.Common;
using BodyBiotics.Domain.Entities;
using BodyBiotics.Infrastructure.Persistence;
using BodyBiotics.Infrastructure.Security;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace BodyBiotics.Api.Features.Auth;

public static class AuthEndpoints
{
    /// <summary>
    /// Hashed for unknown emails so a failed login takes the same time whether
    /// or not the account exists — otherwise response timing enumerates users.
    /// </summary>
    private const string TimingEqualiserPassword = "timing-equaliser";

    public static RouteGroupBuilder MapAuthEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/auth").WithTags("Auth");

        group.MapPost("/register", RegisterAsync)
            .WithName("Register")
            .RequireRateLimiting(RateLimitPolicies.Auth);

        group.MapPost("/login", LoginAsync)
            .WithName("Login")
            .RequireRateLimiting(RateLimitPolicies.Auth);

        // Both rate limited like login: one is an email-sending endpoint anyone
        // can hit, the other is a guess at a token.
        group.MapPost("/forgot-password", ForgotPasswordAsync)
            .WithName("ForgotPassword")
            .RequireRateLimiting(RateLimitPolicies.Auth);

        group.MapPost("/reset-password", ResetPasswordAsync)
            .WithName("ResetPassword")
            .RequireRateLimiting(RateLimitPolicies.Auth);

        group.MapPost("/logout", LogoutAsync).WithName("Logout");
        group.MapGet("/session", GetSessionAsync).WithName("GetSession");

        return api;
    }

    private static async Task<IResult> RegisterAsync(
        RegisterRequest request,
        AppDbContext db,
        IPasswordHasher passwordHasher,
        SessionService sessions,
        CartService cart,
        WishlistService wishlist,
        CartOwnerAccessor cartOwner,
        IValidator<RegisterRequest> validator,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        await validator.ValidateAndThrowAsync(request, cancellationToken);

        var email = request.Email.Trim().ToLowerInvariant();

        if (await db.Users.AnyAsync(user => user.Email == email, cancellationToken))
        {
            throw new ApiException(ApiErrorCode.Conflict, "That email is already registered");
        }

        var user = new User
        {
            Id = Identifier.New(),
            Email = email,
            Name = string.IsNullOrWhiteSpace(request.Name) ? null : request.Name.Trim(),
            PasswordHash = passwordHasher.Hash(request.Password),
        };

        db.Users.Add(user);
        await db.SaveChangesAsync(cancellationToken);
        await sessions.SignInAsync(user, cancellationToken);
        await MergeAnonymousVisitorAsync(cart, wishlist, cartOwner, user.Id, cancellationToken);

        CacheHeaders.Private(httpContext.Response);

        return ApiResults.Created(UserDto.From(user), "/api/auth/session");
    }

    private static async Task<IResult> LoginAsync(
        LoginRequest request,
        AppDbContext db,
        IPasswordHasher passwordHasher,
        SessionService sessions,
        CartService cart,
        WishlistService wishlist,
        CartOwnerAccessor cartOwner,
        IValidator<LoginRequest> validator,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        await validator.ValidateAndThrowAsync(request, cancellationToken);

        var email = request.Email.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(candidate => candidate.Email == email, cancellationToken);

        if (user is null)
        {
            passwordHasher.Hash(TimingEqualiserPassword);
            throw new ApiException(ApiErrorCode.Unauthorized, "Invalid email or password");
        }

        var verification = passwordHasher.Verify(user.PasswordHash, request.Password);

        if (verification == PasswordVerification.Failed)
        {
            throw new ApiException(ApiErrorCode.Unauthorized, "Invalid email or password");
        }

        if (verification == PasswordVerification.SuccessRehashNeeded)
        {
            // Upgrade silently: the only moment we hold the plaintext.
            user.PasswordHash = passwordHasher.Hash(request.Password);
            await db.SaveChangesAsync(cancellationToken);
        }

        await sessions.SignInAsync(user, cancellationToken);
        await MergeAnonymousVisitorAsync(cart, wishlist, cartOwner, user.Id, cancellationToken);
        CacheHeaders.Private(httpContext.Response);

        return ApiResults.Ok(UserDto.From(user));
    }

    /// <summary>
    /// Always 200, whether or not the address has an account. The response is
    /// the same shape and takes the same path either way; anything else turns
    /// this form into an account-existence oracle.
    /// </summary>
    private static async Task<IResult> ForgotPasswordAsync(
        ForgotPasswordRequest request,
        PasswordResetService reset,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        await reset.RequestAsync(request, cancellationToken);

        CacheHeaders.Private(httpContext.Response);
        return ApiResults.Ok(new { sent = true });
    }

    /// <summary>
    /// Signs the customer in on success. They have just proved control of the
    /// mailbox and chosen a password; making them type it again on a login form
    /// is the step where people give up.
    /// </summary>
    private static async Task<IResult> ResetPasswordAsync(
        ResetPasswordRequest request,
        PasswordResetService reset,
        SessionService sessions,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        var user = await reset.ResetAsync(request, cancellationToken);

        // After the revocation sweep inside ResetAsync, so the fresh session
        // is not one of the ones it kills.
        await sessions.SignInAsync(user, cancellationToken);

        CacheHeaders.Private(httpContext.Response);
        return ApiResults.Ok(UserDto.From(user));
    }

    private static async Task<IResult> LogoutAsync(
        SessionService sessions,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        await sessions.SignOutAsync(cancellationToken);
        CacheHeaders.Private(httpContext.Response);

        return ApiResults.Ok(new { signedOut = true });
    }

    private static async Task<IResult> GetSessionAsync(
        SessionService sessions,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        var user = await sessions.GetCurrentUserAsync(cancellationToken);
        CacheHeaders.Private(httpContext.Response);

        return ApiResults.Ok(new SessionDto(user is null ? null : UserDto.From(user)));
    }

    /// <summary>
    /// Folds whatever the visitor collected before signing in — cart and saved
    /// items — onto the account. Without this, signing in at checkout empties
    /// the basket, which is exactly where customers abandon.
    ///
    /// The cookie is cleared last, once both have moved: clearing it first
    /// would strand the wishlist rows under an identity nothing can reach.
    /// </summary>
    private static async Task MergeAnonymousVisitorAsync(
        CartService cart,
        WishlistService wishlist,
        CartOwnerAccessor cartOwner,
        string userId,
        CancellationToken cancellationToken)
    {
        var anonId = cartOwner.CurrentAnonId();
        if (string.IsNullOrEmpty(anonId))
        {
            return;
        }

        await cart.MergeAsync(anonId, userId, cancellationToken);
        await wishlist.MergeAsync(anonId, userId, cancellationToken);
        cartOwner.ClearAnonCookie();
    }
}
