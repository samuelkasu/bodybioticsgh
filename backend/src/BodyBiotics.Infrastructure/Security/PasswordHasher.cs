using BodyBiotics.Domain.Entities;
using Microsoft.AspNetCore.Identity;

namespace BodyBiotics.Infrastructure.Security;

public interface IPasswordHasher
{
    string Hash(string password);

    PasswordVerification Verify(string hash, string password);
}

public enum PasswordVerification
{
    Failed = 0,
    Success = 1,

    /// <summary>Valid, but hashed with outdated parameters — rehash on login.</summary>
    SuccessRehashNeeded = 2,
}

/// <summary>
/// ASP.NET Core's PBKDF2 hasher rather than a third-party bcrypt package: it
/// ships with the framework, carries its own format version, and tells us when
/// a stored hash is stale so logins can transparently upgrade it.
/// </summary>
public sealed class IdentityPasswordHasher : IPasswordHasher
{
    private readonly PasswordHasher<User> _inner = new();

    private static readonly User HashingSubject = new()
    {
        Id = "hashing-subject",
        Email = "hashing@bodybiotics.local",
        PasswordHash = string.Empty,
    };

    public string Hash(string password) => _inner.HashPassword(HashingSubject, password);

    public PasswordVerification Verify(string hash, string password)
    {
        try
        {
            return _inner.VerifyHashedPassword(HashingSubject, hash, password) switch
            {
                PasswordVerificationResult.Success => PasswordVerification.Success,
                PasswordVerificationResult.SuccessRehashNeeded =>
                    PasswordVerification.SuccessRehashNeeded,
                _ => PasswordVerification.Failed,
            };
        }
        catch (FormatException)
        {
            // A stored hash that is not valid base64 (truncated column, hand-
            // edited row) must read as "wrong password", not crash the login
            // endpoint with a 500.
            return PasswordVerification.Failed;
        }
    }
}
