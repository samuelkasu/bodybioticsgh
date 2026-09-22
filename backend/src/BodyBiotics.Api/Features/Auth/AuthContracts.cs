using BodyBiotics.Domain.Entities;
using FluentValidation;

namespace BodyBiotics.Api.Features.Auth;

public sealed record RegisterRequest(string Email, string Password, string? Name);

public sealed record LoginRequest(string Email, string Password);

public sealed record UserDto(string Id, string Email, string? Name, string Role)
{
    public static UserDto From(User user) =>
        new(user.Id, user.Email, user.Name, user.Role.ToString().ToUpperInvariant());
}

public sealed record SessionDto(UserDto? User);

public sealed class RegisterRequestValidator : AbstractValidator<RegisterRequest>
{
    public RegisterRequestValidator()
    {
        RuleFor(request => request.Email).NotEmpty().EmailAddress().MaximumLength(320);
        // Length beats composition rules: a 10-char passphrase is stronger and
        // easier to type on a phone than "P@ss1".
        RuleFor(request => request.Password).NotEmpty().MinimumLength(10).MaximumLength(200);
        RuleFor(request => request.Name).MaximumLength(120).When(request => request.Name is not null);
    }
}

public sealed class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(request => request.Email).NotEmpty().EmailAddress().MaximumLength(320);
        RuleFor(request => request.Password).NotEmpty().MaximumLength(200);
    }
}

public sealed record ForgotPasswordRequest(string Email);

public sealed record ResetPasswordRequest(string Token, string Password);

public sealed class ForgotPasswordRequestValidator : AbstractValidator<ForgotPasswordRequest>
{
    public ForgotPasswordRequestValidator()
    {
        RuleFor(request => request.Email).NotEmpty().EmailAddress().MaximumLength(320);
    }
}

public sealed class ResetPasswordRequestValidator : AbstractValidator<ResetPasswordRequest>
{
    public ResetPasswordRequestValidator()
    {
        RuleFor(request => request.Token).NotEmpty().MaximumLength(200);
        // Same rule as registration. A reset that accepted a weaker password
        // than sign-up would be the easiest way around the sign-up rule.
        RuleFor(request => request.Password).NotEmpty().MinimumLength(10).MaximumLength(200);
    }
}
