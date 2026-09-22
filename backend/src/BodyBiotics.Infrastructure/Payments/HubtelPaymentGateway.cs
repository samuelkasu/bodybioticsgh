using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using BodyBiotics.Domain.Abstractions;
using BodyBiotics.Domain.Common;
using BodyBiotics.Domain.Entities;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace BodyBiotics.Infrastructure.Payments;

/// <summary>
/// Hubtel Online Checkout.
///
/// Two quirks of the API shape this class:
///
/// 1. The initiate response is camelCase (`responseCode`, `data.checkoutUrl`)
///    while the callback is PascalCase (`ResponseCode`, `Data.ClientReference`).
///    Everything here is parsed case-insensitively rather than relying on
///    either convention holding.
/// 2. Callbacks carry no signature. They are a nudge, not evidence — the
///    caller re-asks the status endpoint before believing anything.
/// </summary>
public sealed partial class HubtelPaymentGateway(
    HttpClient http,
    IOptions<HubtelOptions> options,
    ILogger<HubtelPaymentGateway> logger) : IPaymentGateway
{
    private readonly HubtelOptions _options = options.Value;

    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    /// <summary>Hubtel's "all good" code, on both the response and the callback.</summary>
    private const string SuccessCode = "0000";

    public bool IsConfigured => _options.IsConfigured;

    public async Task<PaymentSession> StartAsync(
        Order order,
        CancellationToken cancellationToken)
    {
        if (!IsConfigured)
        {
            throw new InvalidOperationException(
                "Hubtel is not configured. Set Hubtel:ClientId, Hubtel:ClientSecret, " +
                "Hubtel:MerchantAccountNumber and Hubtel:CallbackSecret.");
        }

        var site = _options.SiteUrl.TrimEnd('/');

        var request = new InitiateRequest(
            // Major units: Hubtel prices in cedis, we store pesewas.
            TotalAmount: Money.ToMajor(order.TotalMinor),
            Description: $"Body Biotics order {order.Reference}",
            // The reference is the tie-back for the callback and every later
            // status check, so it is the order's, not a fresh id.
            ClientReference: order.Reference,
            CallbackUrl: $"{_options.PublicApiUrl.TrimEnd('/')}/api/payments/hubtel/callback/{_options.CallbackSecret}",
            ReturnUrl: $"{site}/order/{order.Reference}",
            CancellationUrl: $"{site}/checkout?cancelled={order.Reference}",
            MerchantAccountNumber: _options.MerchantAccountNumber,
            PayeeName: order.FullName,
            PayeeMobileNumber: order.Phone,
            PayeeEmail: order.Email);

        using var message = new HttpRequestMessage(
            HttpMethod.Post,
            $"{_options.CheckoutBaseUrl.TrimEnd('/')}/items/initiate")
        {
            Content = JsonContent.Create(request, options: Json),
        };

        message.Headers.Authorization = BasicAuth(_options.ClientId, _options.ClientSecret);

        using var response = await http.SendAsync(message, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            LogInitiateFailed(logger, order.Reference, (int)response.StatusCode, Trim(body));
            throw new HttpRequestException(
                $"Hubtel refused the checkout for {order.Reference} ({(int)response.StatusCode}).");
        }

        var parsed = JsonSerializer.Deserialize<InitiateResponse>(body, Json);

        if (parsed?.ResponseCode != SuccessCode || parsed.Data?.CheckoutUrl is not { Length: > 0 })
        {
            LogInitiateRejected(logger, order.Reference, parsed?.ResponseCode ?? "none", Trim(body));
            throw new HttpRequestException(
                $"Hubtel did not return a checkout URL for {order.Reference}.");
        }

        return new PaymentSession(parsed.Data.CheckoutUrl, parsed.Data.CheckoutId ?? string.Empty);
    }

    public async Task<PaymentStatus> GetStatusAsync(
        string clientReference,
        CancellationToken cancellationToken)
    {
        if (!IsConfigured)
        {
            return new PaymentStatus(PaymentState.Unknown, 0, null, null);
        }

        var url =
            $"{_options.StatusBaseUrl.TrimEnd('/')}/transactions/{Uri.EscapeDataString(_options.MerchantAccountNumber)}/status" +
            $"?clientReference={Uri.EscapeDataString(clientReference)}";

        using var message = new HttpRequestMessage(HttpMethod.Get, url);

        // Hubtel issues a separate pair for the status API; fall back to the
        // checkout pair when only one set has been configured.
        message.Headers.Authorization = BasicAuth(
            string.IsNullOrWhiteSpace(_options.StatusApiId) ? _options.ClientId : _options.StatusApiId,
            string.IsNullOrWhiteSpace(_options.StatusApiKey) ? _options.ClientSecret : _options.StatusApiKey);

        using var response = await http.SendAsync(message, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);

        // A reference Hubtel has never seen is a normal answer, not a fault:
        // it is what a forged callback looks like.
        if (response.StatusCode == HttpStatusCode.NotFound)
        {
            return new PaymentStatus(PaymentState.Unknown, 0, null, null);
        }

        if (!response.IsSuccessStatusCode)
        {
            LogStatusFailed(logger, clientReference, (int)response.StatusCode, Trim(body));
            throw new HttpRequestException(
                $"Hubtel status check for {clientReference} failed ({(int)response.StatusCode}).");
        }

        var parsed = JsonSerializer.Deserialize<StatusResponse>(body, Json);
        var data = parsed?.Data;

        if (parsed?.ResponseCode != SuccessCode || data is null)
        {
            return new PaymentStatus(PaymentState.Unknown, 0, null, null);
        }

        return new PaymentStatus(
            ToState(data.Status),
            Money.FromMajor(data.Amount),
            data.TransactionId,
            data.PaymentMethod);
    }

    /// <summary>
    /// Hubtel words this differently in different places, so anything that is
    /// not recognisably success or failure is treated as still pending — which
    /// leaves the order unpaid rather than wrongly fulfilled.
    /// </summary>
    private static PaymentState ToState(string? status) => status?.ToLowerInvariant() switch
    {
        "success" or "paid" or "completed" => PaymentState.Paid,
        "failed" or "cancelled" or "canceled" or "expired" => PaymentState.Failed,
        "unpaid" or "pending" or "processing" => PaymentState.Pending,
        _ => PaymentState.Pending,
    };

    private static System.Net.Http.Headers.AuthenticationHeaderValue BasicAuth(
        string id,
        string key) =>
        new("Basic", Convert.ToBase64String(Encoding.UTF8.GetBytes($"{id}:{key}")));

    /// <summary>Bodies can carry customer details; only enough to debug is logged.</summary>
    private static string Trim(string body) =>
        body.Length <= 300 ? body : body[..300];

    private sealed record InitiateRequest(
        decimal TotalAmount,
        string Description,
        string ClientReference,
        string CallbackUrl,
        string ReturnUrl,
        string CancellationUrl,
        string MerchantAccountNumber,
        string? PayeeName,
        string? PayeeMobileNumber,
        string? PayeeEmail);

    private sealed record InitiateResponse(string? ResponseCode, InitiateData? Data);

    private sealed record InitiateData(string? CheckoutUrl, string? CheckoutId);

    private sealed record StatusResponse(string? ResponseCode, StatusData? Data);

    private sealed record StatusData(
        string? Status,
        decimal Amount,
        string? TransactionId,
        string? ClientReference,
        string? PaymentMethod);

    [LoggerMessage(
        Level = LogLevel.Error,
        Message = "Hubtel initiate failed for {Reference}: HTTP {StatusCode} {Body}")]
    private static partial void LogInitiateFailed(
        ILogger logger,
        string reference,
        int statusCode,
        string body);

    [LoggerMessage(
        Level = LogLevel.Error,
        Message = "Hubtel initiate rejected {Reference} with code {Code}: {Body}")]
    private static partial void LogInitiateRejected(
        ILogger logger,
        string reference,
        string code,
        string body);

    [LoggerMessage(
        Level = LogLevel.Error,
        Message = "Hubtel status check failed for {Reference}: HTTP {StatusCode} {Body}")]
    private static partial void LogStatusFailed(
        ILogger logger,
        string reference,
        int statusCode,
        string body);

    /// <summary>
    /// Shape of the unsigned callback. Parsed only to learn which reference to
    /// go and check; nothing in it is trusted.
    /// </summary>
    public sealed record CallbackPayload(string? ResponseCode, CallbackData? Data);

    public sealed record CallbackData(string? ClientReference, string? CheckoutId, string? Status);

    /// <summary>The culture-invariant parse used for amounts quoted as strings.</summary>
    internal static decimal ParseAmount(string? value) =>
        decimal.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : 0m;
}
