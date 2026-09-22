using BodyBiotics.Api.Features.Auth;
using BodyBiotics.Api.Http;
using BodyBiotics.Domain.Common;
using BodyBiotics.Domain.Entities;
using BodyBiotics.Infrastructure.Email;
using BodyBiotics.Infrastructure.Persistence;
using BodyBiotics.Infrastructure.Security;
using BodyBiotics.Tests.Fakes;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace BodyBiotics.Tests.Api;

public sealed class PasswordResetServiceTests : IDisposable
{
    private const string Email = "ama@example.com";
    private const string SiteUrl = "https://bodybioticsgh.com";

    private readonly AppDbContext _db;
    private readonly TestMail _mail = new(SiteUrl);
    private readonly IdentityPasswordHasher _hasher = new();

    public PasswordResetServiceTests() =>
        _db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            // A fresh store per test class: these write users and sessions, and
            // a shared one would let ordering decide the result.
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options);

    public void Dispose() => _db.Dispose();

    private PasswordResetService Build(bool mailConfigured = true) => new(
        _db,
        _hasher,
        _mail.Notifier,
        new FakeEmailSender(mailConfigured),
        Options.Create(new EmailOptions { SiteUrl = SiteUrl }),
        new ForgotPasswordRequestValidator(),
        new ResetPasswordRequestValidator(),
        NullLogger<PasswordResetService>.Instance);

    private async Task<User> SeedUserAsync(string password = "old-password-1")
    {
        var user = new User
        {
            Id = Identifier.New(),
            Email = Email,
            PasswordHash = _hasher.Hash(password),
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        return user;
    }

    /// <summary>Pulls the one-time token back out of the link in the email.</summary>
    private string TokenFromMail()
    {
        var message = Assert.Single(_mail.Drain());
        var marker = "reset-password?token=";
        var start = message.TextBody.IndexOf(marker, StringComparison.Ordinal);
        Assert.True(start >= 0, "The reset email carried no link.");

        var token = message.TextBody[(start + marker.Length)..];
        return Uri.UnescapeDataString(token.Split('\n', ' ')[0].Trim());
    }

    [Fact]
    public async Task SendsALinkToAnAccountThatExists()
    {
        await SeedUserAsync();
        var service = Build();

        await service.RequestAsync(new ForgotPasswordRequest(Email), default);

        Assert.Single(await _db.PasswordResetTokens.ToListAsync());
    }

    [Fact]
    public async Task SaysNothingAboutAnAddressWithNoAccount()
    {
        var service = Build();

        // No throw, no mail, no row. The caller cannot tell this apart from the
        // case above, which is the point — otherwise the form lists customers.
        await service.RequestAsync(new ForgotPasswordRequest("stranger@example.com"), default);

        Assert.Empty(_mail.Drain());
        Assert.Empty(await _db.PasswordResetTokens.ToListAsync());
    }

    [Fact]
    public async Task StoresOnlyTheHashOfTheToken()
    {
        await SeedUserAsync();
        var service = Build();

        await service.RequestAsync(new ForgotPasswordRequest(Email), default);
        var token = TokenFromMail();

        var stored = await _db.PasswordResetTokens.SingleAsync();
        // A database dump must not hand over working reset links.
        Assert.DoesNotContain(token, stored.TokenHash, StringComparison.Ordinal);
        Assert.Equal(64, stored.TokenHash.Length);
    }

    [Fact]
    public async Task AskingTwiceKillsTheFirstLink()
    {
        await SeedUserAsync();
        var service = Build();

        await service.RequestAsync(new ForgotPasswordRequest(Email), default);
        var first = TokenFromMail();

        await service.RequestAsync(new ForgotPasswordRequest(Email), default);
        _ = TokenFromMail();

        // The customer will click the newest mail; the older link must not
        // keep working in whatever inbox it is sitting in.
        var error = await Assert.ThrowsAsync<ApiException>(() =>
            service.ResetAsync(new ResetPasswordRequest(first, "new-password-1"), default));

        Assert.Equal(ApiErrorCode.BadRequest, error.Code);
    }

    [Fact]
    public async Task SetsTheNewPasswordAndSpendsTheToken()
    {
        var user = await SeedUserAsync();
        var service = Build();

        await service.RequestAsync(new ForgotPasswordRequest(Email), default);
        var token = TokenFromMail();

        var reset = await service.ResetAsync(new ResetPasswordRequest(token, "new-password-1"), default);

        Assert.Equal(user.Id, reset.Id);
        Assert.Equal(PasswordVerification.Success, _hasher.Verify(reset.PasswordHash, "new-password-1"));
        Assert.Equal(PasswordVerification.Failed, _hasher.Verify(reset.PasswordHash, "old-password-1"));
        Assert.NotNull((await _db.PasswordResetTokens.SingleAsync()).UsedAt);
    }

    [Fact]
    public async Task TheSameLinkCannotBeUsedTwice()
    {
        await SeedUserAsync();
        var service = Build();

        await service.RequestAsync(new ForgotPasswordRequest(Email), default);
        var token = TokenFromMail();

        await service.ResetAsync(new ResetPasswordRequest(token, "new-password-1"), default);

        // Someone who forwards the mail, or a browser that prefetches the link,
        // must not be able to set a password again.
        await Assert.ThrowsAsync<ApiException>(() =>
            service.ResetAsync(new ResetPasswordRequest(token, "other-password-1"), default));
    }

    [Fact]
    public async Task AnExpiredLinkIsRefused()
    {
        var user = await SeedUserAsync();

        _db.PasswordResetTokens.Add(new PasswordResetToken
        {
            Id = Identifier.New(),
            UserId = user.Id,
            // The hash of "stale-token", computed the same way the service does.
            TokenHash = Convert.ToHexStringLower(
                System.Security.Cryptography.SHA256.HashData("stale-token"u8.ToArray())),
            ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(-1),
        });
        await _db.SaveChangesAsync();

        await Assert.ThrowsAsync<ApiException>(() =>
            Build().ResetAsync(new ResetPasswordRequest("stale-token", "new-password-1"), default));
    }

    [Fact]
    public async Task ResettingSignsEveryDeviceOut()
    {
        var user = await SeedUserAsync();
        _db.Sessions.Add(new Session
        {
            Id = Identifier.New(),
            UserId = user.Id,
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(30),
        });
        await _db.SaveChangesAsync();

        var service = Build();
        await service.RequestAsync(new ForgotPasswordRequest(Email), default);
        await service.ResetAsync(new ResetPasswordRequest(TokenFromMail(), "new-password-1"), default);

        // The usual reason for a reset is that somebody else has the password.
        // Leaving their session alive would make the reset pointless.
        Assert.All(await _db.Sessions.ToListAsync(), session => Assert.NotNull(session.RevokedAt));
    }

    [Fact]
    public async Task RefusesRatherThanPretendWhenNoMailProviderIsWired()
    {
        await SeedUserAsync();

        // Accepting quietly would leave the customer waiting for a mail that
        // can never arrive.
        var error = await Assert.ThrowsAsync<ApiException>(() =>
            Build(mailConfigured: false).RequestAsync(new ForgotPasswordRequest(Email), default));

        Assert.Equal(ApiErrorCode.Conflict, error.Code);
    }

    [Fact]
    public async Task RejectsAPasswordShorterThanRegistrationAllows()
    {
        await SeedUserAsync();
        var service = Build();
        await service.RequestAsync(new ForgotPasswordRequest(Email), default);
        var token = TokenFromMail();

        // Otherwise reset is the way round the sign-up rule.
        await Assert.ThrowsAsync<FluentValidation.ValidationException>(() =>
            service.ResetAsync(new ResetPasswordRequest(token, "short"), default));
    }
}
