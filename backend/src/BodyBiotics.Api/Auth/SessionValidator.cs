using System.Security.Claims;
using BodyBiotics.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;

namespace BodyBiotics.Api.Auth;

/// <summary>
/// Runs on every authenticated request: a valid cookie signature is not proof
/// the session still exists. Without this, "sign out all devices" would do
/// nothing for 30 days.
/// </summary>
public static class SessionValidator
{
    public static async Task ValidateAsync(CookieValidatePrincipalContext context)
    {
        var sessionId = context.Principal?.FindFirstValue(SessionService.SessionIdClaim);

        if (string.IsNullOrEmpty(sessionId))
        {
            context.RejectPrincipal();
            return;
        }

        var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
        var now = DateTimeOffset.UtcNow;

        var session = await db.Sessions
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == sessionId, context.HttpContext.RequestAborted);

        if (session is null || !session.IsActive(now))
        {
            context.RejectPrincipal();
            await context.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return;
        }

        // Cheap liveness signal for the sessions list, throttled so an active
        // shopper does not generate a write per request.
        if (now - session.LastSeenAt > TimeSpan.FromMinutes(15))
        {
            await db.Sessions
                .Where(s => s.Id == sessionId)
                .ExecuteUpdateAsync(
                    setters => setters.SetProperty(s => s.LastSeenAt, now),
                    context.HttpContext.RequestAborted);
        }
    }
}
