using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Http.HttpResults;

namespace BodyBiotics.Api.Http;

public enum ApiErrorCode
{
    BadRequest,
    Unauthorized,
    Forbidden,
    NotFound,
    Conflict,
    RateLimited,
    Internal,
}

public sealed record ApiEnvelope<T>([property: JsonPropertyName("data")] T Data);

public sealed record ApiErrorBody(
    [property: JsonPropertyName("code")] string Code,
    [property: JsonPropertyName("message")] string Message,
    [property: JsonPropertyName("details")]
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        object? Details = null);

public sealed record ApiErrorEnvelope(
    [property: JsonPropertyName("error")] ApiErrorBody Error);

/// <summary>
/// One response shape for the whole API: <c>{ "data": ... }</c> or
/// <c>{ "error": { code, message, details? } }</c>. The PWA's RTK Query layer
/// unwraps this once, so no component ever sees the envelope.
///
/// Deliberately not ProblemDetails: the frontend contract predates the .NET
/// API and every cached response in the installed app's service worker already
/// has this shape.
/// </summary>
public static class ApiResults
{
    public static Ok<ApiEnvelope<T>> Ok<T>(T data) =>
        TypedResults.Ok(new ApiEnvelope<T>(data));

    public static IResult Created<T>(T data, string location) =>
        TypedResults.Created(location, new ApiEnvelope<T>(data));

    public static IResult Fail(ApiErrorCode code, string message, object? details = null) =>
        TypedResults.Json(
            new ApiErrorEnvelope(new ApiErrorBody(ToWireCode(code), message, details)),
            statusCode: ToStatusCode(code));

    public static string ToWireCode(ApiErrorCode code) => code switch
    {
        ApiErrorCode.BadRequest => "BAD_REQUEST",
        ApiErrorCode.Unauthorized => "UNAUTHORIZED",
        ApiErrorCode.Forbidden => "FORBIDDEN",
        ApiErrorCode.NotFound => "NOT_FOUND",
        ApiErrorCode.Conflict => "CONFLICT",
        ApiErrorCode.RateLimited => "RATE_LIMITED",
        _ => "INTERNAL",
    };

    public static int ToStatusCode(ApiErrorCode code) => code switch
    {
        ApiErrorCode.BadRequest => StatusCodes.Status400BadRequest,
        ApiErrorCode.Unauthorized => StatusCodes.Status401Unauthorized,
        ApiErrorCode.Forbidden => StatusCodes.Status403Forbidden,
        ApiErrorCode.NotFound => StatusCodes.Status404NotFound,
        ApiErrorCode.Conflict => StatusCodes.Status409Conflict,
        ApiErrorCode.RateLimited => StatusCodes.Status429TooManyRequests,
        _ => StatusCodes.Status500InternalServerError,
    };
}

/// <summary>Thrown by handlers; translated to the envelope by the exception middleware.</summary>
public sealed class ApiException(ApiErrorCode code, string message, object? details = null)
    : Exception(message)
{
    public ApiErrorCode Code { get; } = code;

    public object? Details { get; } = details;
}
