using BodyBiotics.Domain.Entities;
using Microsoft.AspNetCore.Authorization;

namespace BodyBiotics.Api.Auth;

public static class AuthorizationPolicies
{
    public const string Admin = "admin";

    /// <summary>
    /// The role arrives as a claim on the session cookie, and
    /// <see cref="SessionValidator"/> re-checks the session row on every
    /// request — so revoking an admin's session takes their access with it
    /// immediately rather than when the cookie expires.
    ///
    /// Roles are stored as text in the database (see AppDbContext), so
    /// reordering the enum cannot quietly promote every customer to admin.
    /// </summary>
    public static AuthorizationOptions AddAdminPolicy(this AuthorizationOptions options)
    {
        options.AddPolicy(
            Admin,
            policy => policy
                .RequireAuthenticatedUser()
                .RequireRole(nameof(UserRole.Admin)));

        return options;
    }
}
