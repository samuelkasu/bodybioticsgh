using BodyBiotics.Api.Features.Promotions;
using BodyBiotics.Api.Http;
using BodyBiotics.Domain.Abstractions;
using BodyBiotics.Domain.Common;
using BodyBiotics.Domain.Entities;
using FluentValidation;

namespace BodyBiotics.Api.Features.Cart;

using CartEntity = Domain.Entities.Cart;

/// <summary>
/// Owns the server-side cart. The Redux cart in the PWA is an optimistic
/// mirror of this; this copy is what survives a reinstall, a second device, or
/// iOS evicting the origin's storage.
///
/// It is also where a basket is priced for display. The figures it returns are
/// worked out by the same engine checkout charges with, so what the customer
/// agrees to and what the till takes cannot disagree — but they are still only
/// a display: checkout prices again from the catalogue and never trusts these.
/// </summary>
public sealed class CartService(
    ICartRepository carts,
    IProductRepository products,
    PricingService pricing,
    IValidator<AddToCartRequest> addValidator,
    IValidator<UpdateCartLineRequest> updateValidator,
    IValidator<ApplyCouponRequest> couponValidator)
{
    public async Task<CartDto> GetAsync(CartOwner owner, CancellationToken cancellationToken)
    {
        var cart = await carts.FindAsync(owner, cancellationToken);
        return cart is null ? Empty() : await ToDtoAsync(cart, cancellationToken);
    }

    public async Task<CartDto> AddAsync(
        CartOwner owner,
        AddToCartRequest request,
        CancellationToken cancellationToken)
    {
        await addValidator.ValidateAndThrowAsync(request, cancellationToken);

        var found = await products.FindByIdsAsync([request.ProductId], cancellationToken);
        var product = found.Count > 0
            ? found[0]
            : throw new ApiException(ApiErrorCode.NotFound, "That product does not exist");

        if (!product.Active)
        {
            throw new ApiException(ApiErrorCode.Conflict, "That product is not available");
        }

        // Refuse here rather than at checkout: filling a cart with items that
        // cannot be bought wastes the customer's time and their data.
        if (!product.InStock)
        {
            throw new ApiException(ApiErrorCode.Conflict, $"{product.Name} is out of stock");
        }

        var cart = await carts.GetOrCreateAsync(owner, cancellationToken);
        var line = cart.Items.FirstOrDefault(item => item.ProductId == product.Id);

        if (line is null)
        {
            cart.Items.Add(new CartItem
            {
                Id = Identifier.New(),
                CartId = cart.Id,
                ProductId = product.Id,
                Product = product,
                Quantity = CartItem.ClampQuantity(request.Quantity),
            });
        }
        else
        {
            line.Quantity = CartItem.ClampQuantity(line.Quantity + request.Quantity);
        }

        cart.UpdatedAt = DateTimeOffset.UtcNow;
        await carts.SaveChangesAsync(cancellationToken);

        return await ToDtoAsync(cart, cancellationToken);
    }

    public async Task<CartDto> UpdateAsync(
        CartOwner owner,
        UpdateCartLineRequest request,
        CancellationToken cancellationToken)
    {
        await updateValidator.ValidateAndThrowAsync(request, cancellationToken);

        var cart = await carts.FindAsync(owner, cancellationToken);
        if (cart is null)
        {
            return Empty();
        }

        var line = cart.Items.FirstOrDefault(item => item.ProductId == request.ProductId);
        if (line is null)
        {
            return await ToDtoAsync(cart, cancellationToken);
        }

        var quantity = CartItem.ClampQuantity(request.Quantity);

        if (quantity == 0)
        {
            cart.Items.Remove(line);
        }
        else
        {
            line.Quantity = quantity;
        }

        cart.UpdatedAt = DateTimeOffset.UtcNow;
        await carts.SaveChangesAsync(cancellationToken);

        return await ToDtoAsync(cart, cancellationToken);
    }

    public async Task<CartDto> ClearAsync(CartOwner owner, CancellationToken cancellationToken)
    {
        var cart = await carts.FindAsync(owner, cancellationToken);
        if (cart is null)
        {
            return Empty();
        }

        cart.Items.Clear();
        // The code goes with the basket it was applied to. Leaving it attached
        // to an empty cart means the next thing added silently arrives
        // discounted, which is not what "remove everything" means.
        cart.CouponCode = null;
        cart.UpdatedAt = DateTimeOffset.UtcNow;
        await carts.SaveChangesAsync(cancellationToken);

        return Empty();
    }

    /// <summary>
    /// Attaches a code to the basket. Refused loudly rather than stored and
    /// ignored: a customer who types a code and sees nothing change assumes the
    /// shop is broken, and a code stored despite not applying would surprise
    /// them again at checkout.
    /// </summary>
    public async Task<CartDto> ApplyCouponAsync(
        CartOwner owner,
        ApplyCouponRequest request,
        CancellationToken cancellationToken)
    {
        await couponValidator.ValidateAndThrowAsync(request, cancellationToken);

        var cart = await carts.FindAsync(owner, cancellationToken);
        if (cart is null || cart.Items.Count == 0)
        {
            throw new ApiException(
                ApiErrorCode.BadRequest,
                "Add something to your basket before applying a code.");
        }

        var code = Coupon.Normalise(request.Code);
        var now = DateTimeOffset.UtcNow;

        var priced = await pricing.PriceAsync(
            Lines(cart, now),
            code,
            email: null,
            now,
            cancellationToken);

        if (priced.CouponRejected)
        {
            throw new ApiException(
                ApiErrorCode.Conflict,
                PricingService.Explain(priced.Pricing.CouponRejection, priced.Coupon));
        }

        cart.CouponCode = code;
        cart.UpdatedAt = now;
        await carts.SaveChangesAsync(cancellationToken);

        return ToDto(cart, priced, now);
    }

    public async Task<CartDto> RemoveCouponAsync(
        CartOwner owner,
        CancellationToken cancellationToken)
    {
        var cart = await carts.FindAsync(owner, cancellationToken);
        if (cart is null)
        {
            return Empty();
        }

        cart.CouponCode = null;
        cart.UpdatedAt = DateTimeOffset.UtcNow;
        await carts.SaveChangesAsync(cancellationToken);

        return await ToDtoAsync(cart, cancellationToken);
    }

    /// <summary>
    /// Folds the anonymous cart into the user's on sign-in and deletes it.
    /// Quantities are summed and re-clamped, so adding the same product from
    /// two devices cannot exceed the per-line cap.
    /// </summary>
    public async Task MergeAsync(string anonId, string userId, CancellationToken cancellationToken)
    {
        var anonymous = await carts.FindAsync(CartOwner.ForAnonymous(anonId), cancellationToken);
        if (anonymous is null || anonymous.Items.Count == 0)
        {
            if (anonymous is not null)
            {
                carts.Remove(anonymous);
                await carts.SaveChangesAsync(cancellationToken);
            }

            return;
        }

        var target = await carts.GetOrCreateAsync(CartOwner.ForUser(userId), cancellationToken);

        foreach (var item in anonymous.Items)
        {
            var existing = target.Items.FirstOrDefault(line => line.ProductId == item.ProductId);

            if (existing is null)
            {
                target.Items.Add(new CartItem
                {
                    Id = Identifier.New(),
                    CartId = target.Id,
                    ProductId = item.ProductId,
                    // Carried over so the merged cart is complete in memory,
                    // not only after the next round-trip to the database.
                    Product = item.Product,
                    Quantity = CartItem.ClampQuantity(item.Quantity),
                });
            }
            else
            {
                existing.Quantity = CartItem.ClampQuantity(existing.Quantity + item.Quantity);
            }
        }

        // A code entered before signing in follows the basket in. Signing in
        // halfway through a checkout is exactly when someone has just typed
        // one, and losing it there reads as the shop withdrawing the offer.
        // The account's own code wins if it already had one.
        target.CouponCode ??= anonymous.CouponCode;

        target.UpdatedAt = DateTimeOffset.UtcNow;
        carts.Remove(anonymous);
        await carts.SaveChangesAsync(cancellationToken);
    }

    /// <summary>The basket, as the pricing engine wants it.</summary>
    public static IReadOnlyList<PricingLine> Lines(CartEntity cart, DateTimeOffset now) =>
    [
        .. cart.Items
            .Where(item => item.Product is not null)
            .Select(item => PricingService.ToLine(item.Product!, item.Quantity, now)),
    ];

    private static CartDto Empty() => new(
        [], 0, 0, 0, 0, Money.DefaultCurrency, false, null, [], false, null);

    private async Task<CartDto> ToDtoAsync(CartEntity cart, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;

        var priced = await pricing.PriceAsync(
            Lines(cart, now),
            cart.CouponCode,
            email: null,
            now,
            cancellationToken);

        // A code that has stopped applying — the campaign ended, the basket
        // changed, someone else took the last use — is dropped here rather than
        // carried to a checkout that would refuse it.
        if (cart.CouponCode is not null && priced.CouponRejected)
        {
            cart.CouponCode = null;
            await carts.SaveChangesAsync(cancellationToken);
        }

        return ToDto(cart, priced, now);
    }

    private static CartDto ToDto(CartEntity cart, PricedCart priced, DateTimeOffset now)
    {
        var lineDiscount = priced.Pricing.LineDiscountMinor;

        var lines = cart.Items
            .Where(item => item.Product is not null)
            .OrderBy(item => item.Product!.Name)
            .Select(item => new CartLineDto(
                item.ProductId,
                item.Product!.Slug,
                item.Product.Name,
                item.Product.ImageUrl,
                item.Product.EffectivePriceMinor(now),
                item.Product.CompareAtPriceMinor(now),
                item.Product.Currency,
                item.Quantity,
                item.Product.EffectivePriceMinor(now) * item.Quantity,
                lineDiscount.TryGetValue(item.ProductId, out var discount) ? discount : 0,
                item.Product.InStock,
                item.Product.Stock))
            .ToList();

        var message = priced.Pricing.CouponRejection == CouponRejection.None
            ? null
            : PricingService.Explain(priced.Pricing.CouponRejection, priced.Coupon);

        return new CartDto(
            lines,
            lines.Sum(line => line.Quantity),
            priced.Pricing.SubtotalMinor,
            priced.Pricing.DiscountMinor,
            priced.Pricing.DiscountedSubtotalMinor,
            lines.FirstOrDefault()?.Currency ?? Money.DefaultCurrency,
            lines.Any(line => line.Quantity > line.AvailableStock),
            // Null when the code was just dropped: the client must not re-send
            // a code the server has already refused.
            priced.CouponRejected ? null : cart.CouponCode,
            [
                .. priced.Pricing.Discounts.Select(entry => new CartDiscountDto(
                    entry.Source == DiscountSource.Coupon ? "COUPON" : "PROMOTION",
                    entry.Label,
                    entry.AmountMinor,
                    entry.GrantsFreeDelivery)),
            ],
            priced.Pricing.FreeDeliveryGranted,
            message);
    }
}
