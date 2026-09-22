using System.Security.Claims;
using BodyBiotics.Api.Configuration;
using BodyBiotics.Domain.Common;
using BodyBiotics.Domain.Entities;
using BodyBiotics.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace BodyBiotics.Api.Auth;

public sealed class SessionService(
    AppDbContext db,
    IHttpContextAccessor httpContextAccessor,
    IOptions<AppOptions> options)
{
    public const string SessionIdClaim = "sid";

    private readonly AppOptions _options = options.Value;

    /// <summary>
    /// Issues a Session row and signs the cookie that points at it. The row is
    /// the revocation point: a stolen cookie can be killed server-side without
    /// waiting 30 days for it to expire.
    /// </summary>
    public async Task<Session> SignInAsync(User user, CancellationToken cancellationToken)
    {
        var httpContext = httpContextAccessor.HttpContext
            ?? throw new InvalidOperationException("No HTTP context to sign in against.");

        var session = new Session
        {
            Id = Identifier.New(),
            UserId = user.Id,
            UserAgent = Truncate(httpContext.Request.Headers.UserAgent.ToString(), 512),
            Ip = httpContext.Connection.RemoteIpAddress?.ToString(),
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(_options.SessionTtlDays),
        };

        db.Sessions.Add(session);
        await db.SaveChangesAsync(cancellationToken);

        var principal = new ClaimsPrincipal(new ClaimsIdentity(
            [
                new Claim(ClaimTypes.NameIdentifier, user.Id),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Role, user.Role.ToString()),
                new Claim(SessionIdClaim, session.Id),
            ],
            CookieAuthenticationDefaults.AuthenticationScheme));

        await httpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            principal,
            new AuthenticationProperties
            {
                IsPersistent = true,
                ExpiresUtc = session.ExpiresAt,
            });

        return session;
    }

    public async Task SignOutAsync(CancellationToken cancellationToken)
    {
        var httpContext = httpContextAccessor.HttpContext
            ?? throw new InvalidOperationException("No HTTP context to sign out of.");

        var sessionId = httpContext.User.FindFirstValue(SessionIdClaim);

        if (!string.IsNullOrEmpty(sessionId))
        {
            // ExecuteUpdate, not load-then-save: a session already revoked from
            // another device must not turn a logout into an error.
            await db.Sessions
                .Where(session => session.Id == sessionId && session.RevokedAt == null)
                .ExecuteUpdateAsync(
                    setters => setters.SetProperty(s => s.RevokedAt, DateTimeOffset.UtcNow),
                    cancellationToken);
        }

        await httpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    }

    public async Task<User?> GetCurrentUserAsync(CancellationToken cancellationToken)
    {
        var httpContext = httpContextAccessor.HttpContext;
        var sessionId = httpContext?.User.FindFirstValue(SessionIdClaim);

        if (string.IsNullOrEmpty(sessionId))
        {
            return null;
        }

        var session = await db.Sessions
            .Include(s => s.User)
            .FirstOrDefaultAsync(s => s.Id == sessionId, cancellationToken);

        return session?.IsActive(DateTimeOffset.UtcNow) == true ? session.User : null;
    }

    private static string? Truncate(string? value, int maxLength) =>
        string.IsNullOrEmpty(value) ? null
        : value.Length <= maxLength ? value
        : value[..maxLength];
}
