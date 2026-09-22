namespace BodyBiotics.Domain.Entities;

/// <summary>
/// Server-side session record. The auth cookie carries this row's id, so a
/// session can be revoked without waiting for the cookie to expire — necessary
/// when a device is lost but the installed PWA keeps its 30-day cookie.
/// </summary>
public sealed class Session
{
    public required string Id { get; init; }
    public required string UserId { get; init; }
    public User? User { get; init; }

    public string? UserAgent { get; init; }
    public string? Ip { get; init; }
    public required DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
    public DateTimeOffset LastSeenAt { get; set; } = DateTimeOffset.UtcNow;

    public bool IsActive(DateTimeOffset now) => RevokedAt is null && ExpiresAt > now;
}
