using BodyBiotics.Api.Features.Auth;
using BodyBiotics.Api.Features.Products;
using BodyBiotics.Infrastructure.Security;

namespace BodyBiotics.Tests.Api;

public class ProductListRequestValidatorTests
{
    private readonly ProductListRequestValidator _validator = new();

    [Fact]
    public void AcceptsTheDefaults()
    {
        Assert.True(_validator.Validate(new ProductListRequest()).IsValid);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void RejectsNonPositivePages(int page)
    {
        Assert.False(_validator.Validate(new ProductListRequest(page)).IsValid);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(49)]
    [InlineData(5_000)]
    public void RejectsPerPageOutsideTheCap(int perPage)
    {
        // The cap is what stops a single request dumping the catalogue.
        Assert.False(_validator.Validate(new ProductListRequest(1, perPage)).IsValid);
    }

    [Fact]
    public void AcceptsThePerPageBoundary()
    {
        Assert.True(_validator.Validate(new ProductListRequest(1, 48)).IsValid);
    }

    [Fact]
    public void RejectsAnOverlongSearchTerm()
    {
        var query = new ProductListRequest(Search: new string('a', 81));

        Assert.False(_validator.Validate(query).IsValid);
    }
}

public class AuthValidatorTests
{
    private readonly RegisterRequestValidator _register = new();
    private readonly LoginRequestValidator _login = new();

    [Fact]
    public void RegisterAcceptsAValidRequest()
    {
        var request = new RegisterRequest("customer@example.com", "a-long-enough-password", "Ama");

        Assert.True(_register.Validate(request).IsValid);
    }

    [Theory]
    [InlineData("not-an-email")]
    [InlineData("")]
    public void RegisterRejectsBadEmails(string email)
    {
        Assert.False(_register.Validate(new RegisterRequest(email, "a-long-enough-password", null)).IsValid);
    }

    [Fact]
    public void RegisterRejectsShortPasswords()
    {
        Assert.False(_register.Validate(new RegisterRequest("a@b.com", "short", null)).IsValid);
    }

    [Fact]
    public void LoginDoesNotImposeAMinimumPasswordLength()
    {
        // Rejecting a short password on login would tell an attacker the policy
        // and would break accounts created before a policy change.
        Assert.True(_login.Validate(new LoginRequest("a@b.com", "x")).IsValid);
    }

    [Fact]
    public void LoginRejectsAnEmptyPassword()
    {
        Assert.False(_login.Validate(new LoginRequest("a@b.com", "")).IsValid);
    }
}

public class PasswordHasherTests
{
    private readonly IdentityPasswordHasher _hasher = new();

    [Fact]
    public void VerifiesACorrectPassword()
    {
        var hash = _hasher.Hash("a-long-enough-password");

        Assert.Equal(PasswordVerification.Success, _hasher.Verify(hash, "a-long-enough-password"));
    }

    [Fact]
    public void RejectsAWrongPassword()
    {
        var hash = _hasher.Hash("a-long-enough-password");

        Assert.Equal(PasswordVerification.Failed, _hasher.Verify(hash, "a-long-enough-passworD"));
    }

    [Fact]
    public void SaltsSoIdenticalPasswordsHashDifferently()
    {
        Assert.NotEqual(_hasher.Hash("same-password"), _hasher.Hash("same-password"));
    }

    [Fact]
    public void RejectsGarbageWithoutThrowing()
    {
        Assert.Equal(PasswordVerification.Failed, _hasher.Verify("not-a-hash", "whatever"));
    }
}
