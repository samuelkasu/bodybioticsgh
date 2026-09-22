using BodyBiotics.Api.Http;
using FluentValidation;

namespace BodyBiotics.Api.Features.Contact;

/// <summary>Mirrors the subject options the original contact form offered.</summary>
public enum ContactSubject
{
    Inquiry = 0,
    Complaint = 1,
    Request = 2,
    Suggestion = 3,
}

public sealed record ContactRequest(
    string Name,
    string Email,
    ContactSubject Subject,
    string Message);

public sealed class ContactRequestValidator : AbstractValidator<ContactRequest>
{
    public ContactRequestValidator()
    {
        RuleFor(request => request.Name).NotEmpty().MaximumLength(120);
        RuleFor(request => request.Email).NotEmpty().EmailAddress().MaximumLength(320);
        RuleFor(request => request.Subject).IsInEnum();
        RuleFor(request => request.Message).NotEmpty().MinimumLength(10).MaximumLength(2000);
    }
}

public static class ContactEndpoints
{
    public static RouteGroupBuilder MapContactEndpoints(this RouteGroupBuilder api)
    {
        api.MapPost("/contact", SubmitAsync)
            .WithTags("Contact")
            .WithName("SubmitContactForm")
            // An unthrottled public form is a spam relay.
            .RequireRateLimiting(RateLimitPolicies.Auth);

        return api;
    }

    private static async Task<IResult> SubmitAsync(
        ContactRequest request,
        HttpContext httpContext,
        ContactService contact,
        CancellationToken cancellationToken)
    {
        await contact.SubmitAsync(request, cancellationToken);

        CacheHeaders.Private(httpContext.Response);
        return ApiResults.Ok(new { received = true });
    }
}
