using System.ComponentModel.DataAnnotations;

namespace BodyBiotics.Api.Configuration;

/// <summary>
/// Validated on start (ValidateOnStart below). An API that boots with a missing
/// connection string or a default admin password is worse than one that refuses
/// to start — the failure surfaces at deploy time, not at first checkout.
/// </summary>
public sealed class AppOptions
{
    public const string SectionName = "App";

    [Required]
    [MinLength(1)]
    public required string ConnectionString { get; init; }

    /// <summary>Origins allowed to call the API directly, for local development.</summary>
    public string[] CorsOrigins { get; init; } = [];

    [Range(1, 365)]
    public int SessionTtlDays { get; init; } = 30;

    [Required]
    [EmailAddress]
    public string SeedAdminEmail { get; init; } = "admin@bodybiotics.test";

    [Required]
    [MinLength(12)]
    public string SeedAdminPassword { get; init; } = DefaultSeedAdminPassword;

    /// <summary>
    /// The committed default. Seeding refuses to use it outside Development —
    /// it is in the git history, so an environment that kept it has an admin
    /// account whose password is public.
    /// </summary>
    public const string DefaultSeedAdminPassword = "change-me-locally";

    /// <summary>
    /// Values that have at some point sat in a tracked appsettings file, so
    /// anyone with the repository knows them. Seeding refuses all of them
    /// outside Development, not just the current default — an environment
    /// configured while an older one was committed is the case that matters.
    /// </summary>
    public static readonly IReadOnlySet<string> PubliclyKnownSeedAdminPasswords =
        new HashSet<string>(StringComparer.Ordinal)
        {
            DefaultSeedAdminPassword,
            "1234567891011",
        };

    /// <summary>
    /// Addresses the API accepts X-Forwarded-* from: the Next proxy, and nothing
    /// else. Single addresses ("10.0.0.4") or CIDR ranges ("172.16.0.0/12", which
    /// is what a Docker bridge network needs).
    ///
    /// Leave empty and only loopback is trusted, which is correct locally and
    /// wrong everywhere else: the API then sees every customer as one IP, and
    /// the shared rate-limit bucket locks the whole shop out. Fill it in and
    /// nothing else can spoof a client address past the limiter.
    /// </summary>
    public string[] TrustedProxies { get; init; } = [];

    /// <summary>
    /// Applies migrations and seeds on start. Convenient locally; in production
    /// migrations run as a separate step before the new image takes traffic.
    /// </summary>
    public bool MigrateOnStart { get; init; }
}
