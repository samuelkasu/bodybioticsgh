namespace BodyBiotics.Domain.Entities;

/// <summary>
/// A single password-reset attempt.
///
/// Only the hash of the token is stored. The plaintext exists once, in the
/// email; a database dump then does not hand over a working reset link for
/// every account that has recently asked for one, which would otherwise be a
/// credential store by another name.
/// </summary>
public sealed class PasswordResetToken
{
    public required string Id { get; init; }
    public required string UserId { get; init; }
    public User? User { get; init; }

    /// <summary>SHA-256 of the token as it appears in the link, hex encoded.</summary>
    public required string TokenHash { get; init; }

    public required DateTimeOffset ExpiresAt { get; init; }

    /// <summary>Set the moment the token is spent, which is what makes it single-use.</summary>
    public DateTimeOffset? UsedAt { get; set; }

    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;

    public bool IsUsable(DateTimeOffset now) => UsedAt is null && ExpiresAt > now;
}
