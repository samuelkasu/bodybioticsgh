using FluentValidation;
using Microsoft.AspNetCore.Diagnostics;

namespace BodyBiotics.Api.Http;

/// <summary>
/// Guarantees every failure leaves as JSON in the envelope shape. An HTML error
/// page is poison for the PWA: the client parses it as JSON and the failure
/// looks like a network fault rather than a server error.
/// </summary>
public sealed partial class ApiExceptionHandler(ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var (code, message, details) = exception switch
        {
            ApiException api => (api.Code, api.Message, api.Details),
            ValidationException validation => (
                ApiErrorCode.BadRequest,
                "Invalid request",
                (object?)validation.Errors
                    .GroupBy(failure => failure.PropertyName)
                    .ToDictionary(
                        group => ToCamelCase(group.Key),
                        group => group.Select(failure => failure.ErrorMessage).ToArray())),
            BadHttpRequestException => (ApiErrorCode.BadRequest, "Malformed request", null),
            OperationCanceledException when httpContext.RequestAborted.IsCancellationRequested =>
                (ApiErrorCode.BadRequest, "Request cancelled", null),
            _ => (ApiErrorCode.Internal, "Something went wrong", null),
        };

        if (code == ApiErrorCode.Internal)
        {
            LogUnhandled(logger, exception, httpContext.Request.Method, httpContext.Request.Path);
        }

        httpContext.Response.StatusCode = ApiResults.ToStatusCode(code);
        await httpContext.Response.WriteAsJsonAsync(
            new ApiErrorEnvelope(new ApiErrorBody(ApiResults.ToWireCode(code), message, details)),
            cancellationToken);

        return true;
    }

    [LoggerMessage(Level = LogLevel.Error, Message = "Unhandled error on {Method} {Path}")]
    private static partial void LogUnhandled(ILogger logger, Exception exception, string method, PathString path);

    private static string ToCamelCase(string value) =>
        string.IsNullOrEmpty(value) ? value : char.ToLowerInvariant(value[0]) + value[1..];
}
