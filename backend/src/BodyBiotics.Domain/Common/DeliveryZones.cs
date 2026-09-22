namespace BodyBiotics.Domain.Common;

/// <summary>
/// One delivery area and what it costs to reach. <paramref name="Estimate"/> is
/// customer-facing copy rather than a number of days: the rider's schedule is
/// not a promise the shop can keep to the hour.
/// </summary>
public sealed record DeliveryZone(string Code, string Name, int FeeMinor, string Estimate);

/// <summary>
/// What delivery costs, by area.
///
/// Lives in the domain, not in the client, because the client cannot be trusted
/// with any part of what an order costs — the same reason
/// <see cref="Entities.Order"/> prices every line from the catalogue. The
/// storefront reads this table over the API purely so it can show the figure
/// before the customer commits; the figure that is charged is computed here.
/// </summary>
public static class DeliveryZones
{
    /// <summary>
    /// Spend this much and delivery is free, anywhere in Ghana. Matches the
    /// announcement bar on the storefront — if you change one, change both.
    /// </summary>
    public const int FreeDeliveryThresholdMinor = 200_000;

    /// <summary>Where an order goes when nobody has chosen an area yet.</summary>
    public const string DefaultZoneCode = "other";

    public static readonly IReadOnlyList<DeliveryZone> All =
    [
        new("accra-central", "Accra Central, Osu, Labone", 2_000, "Same or next working day"),
        new("accra-greater", "Rest of Greater Accra", 3_000, "1–2 working days"),
        new("tema", "Tema, Ashaiman, Spintex", 3_000, "1–2 working days"),
        new("kumasi", "Kumasi", 4_500, "2–3 working days"),
        new("takoradi", "Takoradi and the Western Region", 5_000, "2–3 working days"),
        new("other", "Anywhere else in Ghana", 6_000, "3–5 working days"),
    ];

    public static DeliveryZone? Find(string? code) =>
        string.IsNullOrWhiteSpace(code)
            ? null
            : All.FirstOrDefault(zone =>
                string.Equals(zone.Code, code.Trim(), StringComparison.OrdinalIgnoreCase));

    public static bool IsKnown(string? code) => Find(code) is not null;

    /// <summary>
    /// Prices a basket for an area. An unknown code falls back to the dearest
    /// zone rather than to free: guessing low would have the shop absorb the
    /// difference on every order a stale client places.
    /// </summary>
    /// <param name="subtotalMinor">
    /// The goods <em>after</em> any discount. The threshold is deliberately
    /// tested against what the customer actually pays for goods, not against
    /// what they would have paid: otherwise a coupon quietly buys free
    /// delivery as well, and the shop absorbs both.
    /// </param>
    /// <param name="freeDeliveryGranted">
    /// A campaign or coupon waived delivery outright. Separate from the
    /// threshold so the receipt can still say which of the two applied.
    /// </param>
    public static DeliveryQuote Quote(
        int subtotalMinor,
        string? zoneCode,
        bool freeDeliveryGranted = false)
    {
        var zone = Find(zoneCode) ?? Find(DefaultZoneCode)!;
        var qualifies = freeDeliveryGranted || subtotalMinor >= FreeDeliveryThresholdMinor;
        var fee = qualifies ? 0 : zone.FeeMinor;

        return new DeliveryQuote(
            zone.Code,
            zone.Name,
            subtotalMinor,
            fee,
            subtotalMinor + fee,
            qualifies,
            zone.Estimate);
    }
}

public sealed record DeliveryQuote(
    string ZoneCode,
    string ZoneName,
    int SubtotalMinor,
    int DeliveryFeeMinor,
    int TotalMinor,
    bool IsFreeDelivery,
    string Estimate);
