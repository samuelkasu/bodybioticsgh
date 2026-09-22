using System.Globalization;
using System.Net;
using System.Text;
using BodyBiotics.Domain.Common;
using BodyBiotics.Domain.Entities;

namespace BodyBiotics.Api.Features.Notifications;

/// <summary>
/// Builds both bodies of every message the shop sends.
///
/// The HTML is deliberately primitive — one table, inline styles, no external
/// stylesheet, no web font, no remote image. Gmail strips &lt;style&gt; blocks,
/// Outlook ignores most of CSS, and an image-blocked client should still show
/// a complete email. Everything also has a plain-text twin that reads properly
/// on its own, which is what a feature phone's mail client will show.
///
/// Every interpolated value goes through <see cref="Escape"/>. A customer's
/// name and delivery notes are free text, and they end up inside markup.
/// </summary>
public static class EmailTemplates
{
    private const string Ink = "#1b1b1b";
    private const string Muted = "#6b6b6b";
    private const string Cream = "#f5eee7";
    private const string Line = "#e4dcd2";

    public static (string Subject, string Html, string Text) OrderPlaced(Order order, string siteUrl)
    {
        var subject = $"Order {order.Reference} received";

        var lead = order.PaymentMethod == PaymentMethod.Hubtel
            ? "Thank you. We have your order and are waiting for your payment to clear. You will get another email the moment it does."
            : "Thank you. We have your order. We will call you on the number below to confirm before delivery, and you pay when it arrives.";

        return (
            subject,
            Document(
                "Order received",
                Paragraph(lead) +
                OrderSummaryHtml(order) +
                DeliveryHtml(order) +
                ButtonHtml("View your order", OrderUrl(siteUrl, order))),
            Text(
                "ORDER RECEIVED",
                lead,
                OrderSummaryText(order),
                DeliveryText(order),
                $"View your order: {OrderUrl(siteUrl, order)}"));
    }

    public static (string Subject, string Html, string Text) OrderPaid(Order order, string siteUrl)
    {
        const string lead =
            "Your payment has cleared and your order is confirmed. We are packing it now and will call you before it goes out.";

        return (
            $"Payment received for {order.Reference}",
            Document(
                "Payment received",
                Paragraph(lead) +
                OrderSummaryHtml(order) +
                DeliveryHtml(order) +
                ButtonHtml("View your order", OrderUrl(siteUrl, order))),
            Text(
                "PAYMENT RECEIVED",
                lead,
                OrderSummaryText(order),
                DeliveryText(order),
                $"View your order: {OrderUrl(siteUrl, order)}"));
    }

    public static (string Subject, string Html, string Text) OrderFulfilled(Order order, string siteUrl)
    {
        var lead = order.PaymentMethod == PaymentMethod.Hubtel
            ? "Your order is on its way. Our rider will call you on the number below when they are close."
            : $"Your order is on its way. Our rider will call you on the number below when they are close, and will collect {Money.Format(order.TotalMinor, order.Currency)} on delivery.";

        return (
            $"Order {order.Reference} is on its way",
            Document(
                "On its way",
                Paragraph(lead) +
                OrderSummaryHtml(order) +
                DeliveryHtml(order) +
                ButtonHtml("View your order", OrderUrl(siteUrl, order))),
            Text(
                "ON ITS WAY",
                lead,
                OrderSummaryText(order),
                DeliveryText(order),
                $"View your order: {OrderUrl(siteUrl, order)}"));
    }

    public static (string Subject, string Html, string Text) OrderCancelled(Order order, string siteUrl)
    {
        // Careful with the wording: refunds are still processed by hand, so
        // this must not promise money is already on its way back.
        const string lead =
            "Your order has been cancelled and nothing will be delivered. If you had already paid, reply to this email and we will return the money. If this is a surprise to you, reply and we will sort it out.";

        return (
            $"Order {order.Reference} cancelled",
            Document(
                "Order cancelled",
                Paragraph(lead) + OrderSummaryHtml(order) + ButtonHtml("Shop again", $"{siteUrl}/shop")),
            Text("ORDER CANCELLED", lead, OrderSummaryText(order), $"Shop again: {siteUrl}/shop"));
    }

    /// <summary>
    /// The shop's copy of a new order. Terser than the customer's — whoever
    /// reads this needs the phone number and the address, not reassurance.
    /// </summary>
    public static (string Subject, string Html, string Text) NewOrderForShop(Order order, string siteUrl)
    {
        var method = order.PaymentMethod == PaymentMethod.Hubtel ? "paid online" : "pay on delivery";
        var lead = $"New order {order.Reference} — {Money.Format(order.TotalMinor, order.Currency)}, {method}.";

        return (
            $"New order {order.Reference} ({Money.Format(order.TotalMinor, order.Currency)})",
            Document(
                "New order",
                Paragraph(lead) +
                OrderSummaryHtml(order) +
                DeliveryHtml(order) +
                ButtonHtml("Open in admin", $"{siteUrl}/admin/orders/{Uri.EscapeDataString(order.Reference)}")),
            Text(
                "NEW ORDER",
                lead,
                OrderSummaryText(order),
                DeliveryText(order),
                $"Open in admin: {siteUrl}/admin/orders/{Uri.EscapeDataString(order.Reference)}"));
    }

    public static (string Subject, string Html, string Text) ContactEnquiry(
        string name,
        string email,
        string subjectLine,
        string message)
    {
        var body =
            Row("From", name) +
            Row("Email", email) +
            Row("Subject", subjectLine);

        return (
            $"Contact form: {subjectLine} from {name}",
            Document(
                "Contact enquiry",
                $"<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\">{body}</table>" +
                Paragraph(message)),
            Text(
                "CONTACT ENQUIRY",
                $"From: {name}\nEmail: {email}\nSubject: {subjectLine}",
                message,
                "Reply to this email to answer the customer directly."));
    }

    public static (string Subject, string Html, string Text) PasswordReset(string resetUrl, int validMinutes)
    {
        var lead =
            $"Use the link below to set a new password. It works once and expires in {validMinutes} minutes. " +
            "If you did not ask for this, ignore this email — your password has not changed.";

        return (
            "Reset your Body Biotics password",
            Document(
                "Reset your password",
                Paragraph(lead) +
                ButtonHtml("Set a new password", resetUrl) +
                $"<p style=\"margin:24px 0 0;font-size:13px;line-height:20px;color:{Muted};word-break:break-all\">" +
                $"If the button does not work, paste this into your browser:<br>{Escape(resetUrl)}</p>"),
            Text(
                "RESET YOUR PASSWORD",
                lead,
                resetUrl,
                "If you did not ask for this, no action is needed."));
    }

    private static string OrderUrl(string siteUrl, Order order) =>
        $"{siteUrl.TrimEnd('/')}/order/{Uri.EscapeDataString(order.Reference)}";

    private static string OrderSummaryHtml(Order order)
    {
        var rows = new StringBuilder();

        foreach (var item in order.Items)
        {
            rows.Append(CultureInfo.InvariantCulture, $"""
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid {Line};font-size:15px;color:{Ink}">
                    {Escape(item.Product?.Name ?? "Product")} &times; {item.Quantity}
                  </td>
                  <td style="padding:8px 0;border-bottom:1px solid {Line};font-size:15px;color:{Ink};text-align:right;white-space:nowrap">
                    {Escape(Money.Format(item.LineTotalMinor, order.Currency))}
                  </td>
                </tr>
                """);
        }

        return $"""
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:24px 0">
              <tr>
                <td colspan="2" style="padding-bottom:8px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:{Muted}">
                  Order {Escape(order.Reference)}
                </td>
              </tr>
              {rows}
              {TotalsHtml(order)}
            </table>
            """;
    }

    /// <summary>
    /// Subtotal, any discount, delivery and total — the same lines the customer
    /// agreed to at checkout. A receipt that shows only a total is the one a
    /// customer rings up about, and one whose lines do not add up to its total
    /// is worse still.
    /// </summary>
    private static string TotalsHtml(Order order)
    {
        var subtotal = order.SubtotalMinor > 0 ? order.SubtotalMinor : order.TotalMinor;

        var delivery = order.DeliveryFeeMinor > 0
            ? Money.Format(order.DeliveryFeeMinor, order.Currency)
            : "Free";

        var discount = order.DiscountMinor <= 0
            ? string.Empty
            : $"""
              <tr>
                <td style="padding:4px 0 0;font-size:15px;color:{Muted}">
                  {Escape(order.DiscountDescription ?? "Discount")}{(order.CouponCode is null ? string.Empty : $" &mdash; {Escape(order.CouponCode)}")}
                </td>
                <td style="padding:4px 0 0;font-size:15px;color:{Ink};text-align:right;white-space:nowrap">
                  &minus;{Escape(Money.Format(order.DiscountMinor, order.Currency))}
                </td>
              </tr>
            """;

        return $"""
              <tr>
                <td style="padding:12px 0 0;font-size:15px;color:{Muted}">Subtotal</td>
                <td style="padding:12px 0 0;font-size:15px;color:{Ink};text-align:right;white-space:nowrap">
                  {Escape(Money.Format(subtotal, order.Currency))}
                </td>
              </tr>
            {discount}
              <tr>
                <td style="padding:4px 0 0;font-size:15px;color:{Muted}">
                  Delivery{(string.IsNullOrWhiteSpace(order.DeliveryZoneName) ? string.Empty : $" &mdash; {Escape(order.DeliveryZoneName)}")}
                </td>
                <td style="padding:4px 0 0;font-size:15px;color:{Ink};text-align:right;white-space:nowrap">
                  {Escape(delivery)}
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0 0;border-top:1px solid {Line};font-size:16px;font-weight:bold;color:{Ink}">Total</td>
                <td style="padding:10px 0 0;border-top:1px solid {Line};font-size:16px;font-weight:bold;color:{Ink};text-align:right;white-space:nowrap">
                  {Escape(Money.Format(order.TotalMinor, order.Currency))}
                </td>
              </tr>
            """;
    }

    private static string OrderSummaryText(Order order)
    {
        var builder = new StringBuilder();
        builder.Append(CultureInfo.InvariantCulture, $"Order {order.Reference}\n");

        foreach (var item in order.Items)
        {
            builder.Append(CultureInfo.InvariantCulture,
                $"  {item.Product?.Name ?? "Product"} x{item.Quantity}  {Money.Format(item.LineTotalMinor, order.Currency)}\n");
        }

        var subtotal = order.SubtotalMinor > 0 ? order.SubtotalMinor : order.TotalMinor;
        var delivery = order.DeliveryFeeMinor > 0
            ? Money.Format(order.DeliveryFeeMinor, order.Currency)
            : "Free";

        builder.Append(CultureInfo.InvariantCulture,
            $"  Subtotal: {Money.Format(subtotal, order.Currency)}\n");

        if (order.DiscountMinor > 0)
        {
            var label = order.DiscountDescription ?? "Discount";
            builder.Append(CultureInfo.InvariantCulture,
                $"  {label}: -{Money.Format(order.DiscountMinor, order.Currency)}\n");
        }

        builder.Append(CultureInfo.InvariantCulture,
            $"  Delivery: {delivery}\n");
        builder.Append(CultureInfo.InvariantCulture,
            $"  Total: {Money.Format(order.TotalMinor, order.Currency)}");

        return builder.ToString();
    }

    private static string DeliveryHtml(Order order)
    {
        var rows =
            Row("Name", order.FullName) +
            Row("Phone", order.Phone) +
            Row("Address", $"{order.AddressLine}, {order.City}") +
            (string.IsNullOrWhiteSpace(order.DeliveryZoneName)
                ? string.Empty
                : Row("Area", order.DeliveryZoneName)) +
            (string.IsNullOrWhiteSpace(order.Notes) ? string.Empty : Row("Notes", order.Notes));

        return $"""
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
                   style="margin:0 0 24px;background:{Cream};border-radius:10px;padding:16px">
              <tr>
                <td colspan="2" style="padding-bottom:8px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:{Muted}">
                  Delivery
                </td>
              </tr>
              {rows}
            </table>
            """;
    }

    private static string DeliveryText(Order order)
    {
        var notes = string.IsNullOrWhiteSpace(order.Notes) ? string.Empty : $"\n  Notes: {order.Notes}";
        var area = string.IsNullOrWhiteSpace(order.DeliveryZoneName)
            ? string.Empty
            : $"\n  Area: {order.DeliveryZoneName}";

        return $"Delivery\n  {order.FullName}\n  {order.Phone}\n  {order.AddressLine}, {order.City}{area}{notes}";
    }

    private static string Row(string label, string value) => $"""
        <tr>
          <td style="padding:4px 12px 4px 0;font-size:15px;color:{Muted};vertical-align:top;white-space:nowrap">{Escape(label)}</td>
          <td style="padding:4px 0;font-size:15px;color:{Ink};vertical-align:top">{Escape(value)}</td>
        </tr>
        """;

    private static string Paragraph(string text) =>
        $"<p style=\"margin:0 0 16px;font-size:16px;line-height:24px;color:{Ink}\">{Escape(text)}</p>";

    /// <summary>
    /// A bordered link, not a &lt;button&gt;: Outlook renders form controls
    /// unpredictably, and a padded anchor is the one shape every client agrees on.
    /// </summary>
    private static string ButtonHtml(string label, string url) => $"""
        <p style="margin:24px 0 0">
          <a href="{Escape(url)}"
             style="display:inline-block;padding:12px 24px;border-radius:999px;background:{Ink};
                    color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none">{Escape(label)}</a>
        </p>
        """;

    private static string Document(string heading, string body) => $"""
        <!doctype html>
        <html lang="en"><head><meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="margin:0;padding:24px 12px;background:{Cream};font-family:Arial,Helvetica,sans-serif">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto">
            <tr><td style="background:#ffffff;border-radius:16px;padding:32px 24px">
              <p style="margin:0 0 4px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:{Muted}">Body Biotics GH</p>
              <h1 style="margin:0 0 20px;font-size:24px;line-height:32px;color:{Ink}">{Escape(heading)}</h1>
              {body}
            </td></tr>
            <tr><td style="padding:20px 8px;text-align:center;font-size:13px;line-height:20px;color:{Muted}">
              Body Biotics GH &middot; Accra, Ghana
            </td></tr>
          </table>
        </body></html>
        """;

    private static string Text(params string[] blocks) =>
        string.Join("\n\n", blocks.Where(block => !string.IsNullOrWhiteSpace(block))) +
        "\n\n--\nBody Biotics GH, Accra, Ghana\n";

    private static string Escape(string value) => WebUtility.HtmlEncode(value);
}
