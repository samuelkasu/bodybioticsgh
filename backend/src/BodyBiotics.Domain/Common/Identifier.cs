using System.Security.Cryptography;

namespace BodyBiotics.Domain.Common;

/// <summary>
/// Sortable, URL-safe string ids. Sequential-by-time so Postgres index inserts
/// stay at the right edge of the B-tree instead of scattering like a GUIDv4,
/// and opaque enough that an order id does not leak how many orders exist.
/// </summary>
public static class Identifier
{
    public static string New() => Ulid();

    /// <summary>
    /// Order reference a customer can read out over the phone. The suffix is 40
    /// bits from the cryptographic RNG, not a five-digit number: five digits
    /// collide against the unique index roughly one day in five at 200 orders a
    /// day, and a reference short enough to guess is a reference an outsider can
    /// walk to read other people's orders.
    /// </summary>
    public static string OrderReference(DateTimeOffset now)
    {
        Span<byte> random = stackalloc byte[ReferenceSuffixLength];
        RandomNumberGenerator.Fill(random);

        Span<char> suffix = stackalloc char[ReferenceSuffixLength];
        for (var i = 0; i < ReferenceSuffixLength; i++)
        {
            // 256 is a whole multiple of 32, so masking stays uniform.
            suffix[i] = ReferenceAlphabet[random[i] & 31];
        }

        return $"BB-{now:yyyyMMdd}-{suffix}";
    }

    private const int ReferenceSuffixLength = 8;

    /// <summary>Crockford base32: no I, L, O or U, so nothing is misheard as something else.</summary>
    private const string ReferenceAlphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

    private static string Ulid()
    {
        Span<byte> buffer = stackalloc byte[16];
        var timestamp = (ulong)DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        // 48-bit big-endian timestamp, then 80 bits of randomness (ULID layout).
        buffer[0] = (byte)(timestamp >> 40);
        buffer[1] = (byte)(timestamp >> 32);
        buffer[2] = (byte)(timestamp >> 24);
        buffer[3] = (byte)(timestamp >> 16);
        buffer[4] = (byte)(timestamp >> 8);
        buffer[5] = (byte)timestamp;
        // Cryptographic, not Random.Shared: some of these ids are bearer
        // credentials — the anonymous cart cookie names one, and a session row
        // is revoked by its id. Random.Shared is xoshiro256**, whose state can
        // be recovered from a handful of observed outputs, and the API hands
        // ids out freely.
        RandomNumberGenerator.Fill(buffer[6..]);

        return Convert.ToHexStringLower(buffer);
    }
}
