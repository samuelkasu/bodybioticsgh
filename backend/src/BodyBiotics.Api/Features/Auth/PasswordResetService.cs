using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;
using BodyBiotics.Api.Features.Notifications;
using BodyBiotics.Api.Http;
using BodyBiotics.Domain.Abstractions;
using BodyBiotics.Domain.Common;
using BodyBiotics.Domain.Entities;
using BodyBiotics.Infrastructure.Email;
using BodyBiotics.Infrastructure.Persistence;
using BodyBiotics.Infrastructure.Security;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace BodyBiotics.Api.Features.Auth;

/// <summary>
/// Issues and spends password-reset tokens.
///
/// Two rules shape everything here. An unknown email must be indistinguishable
/// from a known one — the login path already refuses to leak which addresses
/// have accounts, and a reset form that says "no such account" hands that back.
/// And a reset must end every existing session: the usual reason someone resets
/// a password is that they think somebody else has it.
/// </summary>
public sealed partial class PasswordResetService(
    AppDbContext db,
    IPasswordHasher passwordHasher,
    OrderNotifier notifications,
    IEmailSender mail,
    IOptions<EmailOptions> emailOptions,
    IValidator<ForgotPasswordRequest> forgotValidator,
    IValidator<ResetPasswordRequest> resetValidator,
    ILogger<PasswordResetService> logger)
{
    /// <summary>
    /// Short enough that a link sitting in an abandoned inbox stops being a way
    /// in, long enough for someone to find the message on a slow connection.
    /// </summary>
    public const int ValidMinutes = 60;

    private readonly EmailOptions _emailOptions = emailOptions.Value;

    public async Task RequestAsync(ForgotPasswordRequest request, CancellationToken cancellationToken)
    {
        await forgotValidator.ValidateAndThrowAsync(request, cancellationToken);

        if (!mail.IsConfigured)
        {
            // Better to say so than to accept the request and send nothing —
            // the customer would sit waiting for a mail that cannot arrive.
            throw new ApiException(
                ApiErrorCode.Conflict,
                "Password reset by email is not available yet. Contact us on WhatsApp and we will verify you.");
        }

        var email = request.Email.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(
            candidate => candidate.Email == email,
            cancellationToken);

        if (user is null)
        {
            // Deliberately silent. The endpoint answers the same either way.
            LogUnknownEmail(logger);
            return;
        }

        // Any link already out there stops working. Someone who asks twice
        // because the first mail was slow should not end up with two live
        // tokens, and the newest one is the one they will click.
        var outstanding = await db.PasswordResetTokens
            .Where(token => token.UserId == user.Id && token.UsedAt == null)
            .ToListAsync(cancellationToken);

        foreach (var token in outstanding)
        {
            token.UsedAt = DateTimeOffset.UtcNow;
        }

        var secret = NewToken();

        db.PasswordResetTokens.Add(new PasswordResetToken
        {
            Id = Identifier.New(),
            UserId = user.Id,
            TokenHash = Hash(secret),
            ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(ValidMinutes),
        });

        await db.SaveChangesAsync(cancellationToken);

        var url = $"{_emailOptions.SiteUrl.TrimEnd('/')}/account/reset-password?token={Uri.EscapeDataString(secret)}";
        notifications.PasswordReset(user.Email, url, ValidMinutes);
    }

    /// <summary>
    /// Spends the token and sets the new password. Returns the user so the
    /// caller can sign them straight in — the alternative is asking someone to
    /// type a password they invented ten seconds ago all over again.
    /// </summary>
    public async Task<User> ResetAsync(ResetPasswordRequest request, CancellationToken cancellationToken)
    {
        await resetValidator.ValidateAndThrowAsync(request, cancellationToken);

        var hash = Hash(request.Token.Trim());

        var token = await db.PasswordResetTokens
            .Include(candidate => candidate.User)
            .FirstOrDefaultAsync(candidate => candidate.TokenHash == hash, cancellationToken);

        if (token?.User is null || !token.IsUsable(DateTimeOffset.UtcNow))
        {
            // One message for expired, spent and never-existed alike. Telling
            // them apart tells someone holding a stolen link which it is.
            throw new ApiException(
                ApiErrorCode.BadRequest,
                "That reset link has expired or has already been used. Request a new one.");
        }

        token.UsedAt = DateTimeOffset.UtcNow;
        token.User.PasswordHash = passwordHasher.Hash(request.Password);

        // Every device is signed out, including whoever prompted the reset.
        // Loaded rather than a bulk update: it is a handful of rows per person,
        // and it keeps the whole reset inside one SaveChanges, so a failure
        // cannot leave the password changed with the old sessions still live.
        var sessions = await db.Sessions
            .Where(session => session.UserId == token.UserId && session.RevokedAt == null)
            .ToListAsync(cancellationToken);

        foreach (var session in sessions)
        {
            session.RevokedAt = DateTimeOffset.UtcNow;
        }

        await db.SaveChangesAsync(cancellationToken);
        LogReset(logger, token.UserId);

        return token.User;
    }

    /// <summary>
    /// 256 bits, base64url so it survives a mail client turning the link into
    /// text and back.
    /// </summary>
    private static string NewToken()
    {
        Span<byte> bytes = stackalloc byte[32];
        RandomNumberGenerator.Fill(bytes);
        return Base64Url.EncodeToString(bytes);
    }

    /// <summary>
    /// Plain SHA-256, not a password hash: the input is 256 random bits, so
    /// there is no dictionary to slow down, and a reset has to be fast.
    /// </summary>
    private static string Hash(string token) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    [LoggerMessage(
        Level = LogLevel.Information,
        Message = "Password reset requested for an address with no account")]
    private static partial void LogUnknownEmail(ILogger logger);

    [LoggerMessage(
        Level = LogLevel.Information,
        Message = "Password reset completed for {UserId}; all sessions revoked")]
    private static partial void LogReset(ILogger logger, string userId);
}
