using System.Globalization;

namespace BodyBiotics.Domain.Common;

/// <summary>
/// Everything monetary crosses the wire as minor units. This is the only place
/// that converts, so a rounding decision cannot be made twice differently.
/// </summary>
public static class Money
{
    public const string DefaultCurrency = "GHS";

    public static decimal ToMajor(int minor) => minor / 100m;

    public static int FromMajor(decimal major) =>
        (int)Math.Round(major * 100m, MidpointRounding.AwayFromZero);

    public static string Format(int minor, string currency = DefaultCurrency) =>
        string.Create(
            CultureInfo.InvariantCulture,
            $"{currency} {ToMajor(minor):N2}");
}
