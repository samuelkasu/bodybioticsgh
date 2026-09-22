using BodyBiotics.Api.Http;
using BodyBiotics.Domain.Common;

namespace BodyBiotics.Api.Features.Reviews;

/// <summary>
/// Writes review photos under wwwroot/uploads/reviews so the static file
/// middleware can serve them. Nothing the client says is trusted: the extension
/// comes from the file's own leading bytes rather than its Content-Type header,
/// and the file name is a fresh id, so an upload can neither traverse out of the
/// directory nor land as something executable.
/// </summary>
public sealed class ReviewPhotoStore(IWebHostEnvironment environment)
{
    /// <summary>4MB: enough for a phone photo, small enough not to be a payload.</summary>
    public const long MaxBytes = 4 * 1024 * 1024;

    /// <summary>Enough for the longest signature below (WebP needs 12).</summary>
    private const int SignatureLength = 12;

    public async Task<string> SaveAsync(IFormFile photo, CancellationToken cancellationToken)
    {
        if (photo.Length == 0)
        {
            throw new ApiException(ApiErrorCode.BadRequest, "That photo is empty.");
        }

        if (photo.Length > MaxBytes)
        {
            throw new ApiException(ApiErrorCode.BadRequest, "Photos must be 4MB or smaller.");
        }

        // Content-Type is whatever the client chose to send. Read the bytes.
        string extension;
        var signature = new byte[SignatureLength];

        await using (var source = photo.OpenReadStream())
        {
            var read = await source.ReadAtLeastAsync(
                signature,
                SignatureLength,
                throwOnEndOfStream: false,
                cancellationToken);

            if (read < SignatureLength || ExtensionFor(signature) is not { } sniffed)
            {
                throw new ApiException(
                    ApiErrorCode.BadRequest,
                    "Photos must be a JPEG, PNG or WebP image.");
            }

            extension = sniffed;
        }

        var root = environment.WebRootPath
            ?? Path.Combine(environment.ContentRootPath, "wwwroot");
        var directory = Path.Combine(root, "uploads", "reviews");
        Directory.CreateDirectory(directory);

        var fileName = $"{Identifier.New()}{extension}";
        var path = Path.Combine(directory, fileName);

        await using (var stream = File.Create(path))
        {
            await photo.CopyToAsync(stream, cancellationToken);
        }

        return $"/uploads/reviews/{fileName}";
    }

    /// <summary>
    /// The file's own leading bytes decide what it is. Returns null for anything
    /// that is not one of the three formats a phone camera or a browser produces.
    /// </summary>
    private static string? ExtensionFor(ReadOnlySpan<byte> signature) => signature switch
    {
        [0xFF, 0xD8, 0xFF, ..] => ".jpg",
        [0x89, (byte)'P', (byte)'N', (byte)'G', 0x0D, 0x0A, 0x1A, 0x0A, ..] => ".png",
        // RIFF....WEBP — the four bytes between are the file size.
        [(byte)'R', (byte)'I', (byte)'F', (byte)'F', _, _, _, _,
            (byte)'W', (byte)'E', (byte)'B', (byte)'P'] => ".webp",
        _ => null,
    };

    /// <summary>Removes a photo a review no longer points at. Never throws.</summary>
    public void Delete(string? photoUrl)
    {
        if (string.IsNullOrWhiteSpace(photoUrl) || !photoUrl.StartsWith("/uploads/reviews/", StringComparison.Ordinal))
        {
            return;
        }

        var root = environment.WebRootPath
            ?? Path.Combine(environment.ContentRootPath, "wwwroot");
        var path = Path.Combine(root, photoUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));

        try
        {
            File.Delete(path);
        }
        catch (IOException)
        {
            // An orphaned file is not worth failing the customer's write over.
        }
        catch (UnauthorizedAccessException)
        {
        }
    }
}
