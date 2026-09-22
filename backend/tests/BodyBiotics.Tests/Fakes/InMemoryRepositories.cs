using BodyBiotics.Domain.Abstractions;
using BodyBiotics.Domain.Entities;

namespace BodyBiotics.Tests.Fakes;

using CartEntity = BodyBiotics.Domain.Entities.Cart;

/// <summary>
/// Hand-written fakes rather than a mocking library: the services under test
/// depend on four small interfaces, and a fake that actually stores state
/// catches ordering bugs a strict mock would wave through.
/// </summary>
public sealed class FakeProductRepository(params Product[] products) : IProductRepository
{
    public List<Product> Products { get; } = [.. products];

    private static string[] Split(string value) =>
        value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    public Task<PagedResult<Product>> SearchAsync(ProductQuery query, CancellationToken cancellationToken)
    {
        IEnumerable<Product> results = Products.Where(product => product.Active);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            results = results.Where(product =>
                product.Name.Contains(query.Search, StringComparison.OrdinalIgnoreCase));
        }

        // Both terms accept a comma-separated list, matching the real repository.
        if (!string.IsNullOrWhiteSpace(query.CategorySlug))
        {
            var slugs = Split(query.CategorySlug);
            results = results.Where(product =>
                product.Category is not null && slugs.Contains(product.Category.Slug));
        }

        if (!string.IsNullOrWhiteSpace(query.BrandSlug))
        {
            var slugs = Split(query.BrandSlug);
            results = results.Where(product =>
                product.Brand is not null && slugs.Contains(product.Brand.Slug));
        }

        if (!string.IsNullOrWhiteSpace(query.Letter))
        {
            results = results.Where(product =>
                product.Name.StartsWith(query.Letter, StringComparison.OrdinalIgnoreCase));
        }

        if (query.MinPriceMinor is { } min)
        {
            results = results.Where(product => product.PriceMinor >= min);
        }

        if (query.MaxPriceMinor is { } max)
        {
            results = results.Where(product => product.PriceMinor <= max);
        }

        var all = results.ToList();

        var ordered = query.Sort switch
        {
            ProductSort.PriceAscending => all.OrderBy(product => product.PriceMinor).ToList(),
            ProductSort.PriceDescending => all.OrderByDescending(product => product.PriceMinor).ToList(),
            ProductSort.Alphabetical => all.OrderBy(product => product.Name, StringComparer.Ordinal).ToList(),
            _ => all.OrderByDescending(product => product.CreatedAt).ToList(),
        };

        var page = ordered.Skip(query.Skip).Take(query.PerPage).ToList();
        return Task.FromResult(new PagedResult<Product>(page, query.Page, query.PerPage, all.Count));
    }

    public Task<Product?> FindBySlugAsync(string slug, CancellationToken cancellationToken) =>
        Task.FromResult(Products.FirstOrDefault(product => product.Slug == slug && product.Active));

    public Task<IReadOnlyList<Product>> FindRelatedAsync(Product product, int take, CancellationToken cancellationToken)
    {
        IReadOnlyList<Product> related = Products
            .Where(candidate =>
                candidate.Active &&
                candidate.Id != product.Id &&
                candidate.CategoryId is not null &&
                candidate.CategoryId == product.CategoryId)
            .Take(take)
            .ToList();

        return Task.FromResult(related);
    }

    public Task<IReadOnlyList<Product>> FindByIdsAsync(IReadOnlyCollection<string> ids, CancellationToken cancellationToken)
    {
        IReadOnlyList<Product> found = Products.Where(product => ids.Contains(product.Id)).ToList();
        return Task.FromResult(found);
    }

    public Task<PriceRange> GetPriceRangeAsync(CancellationToken cancellationToken)
    {
        var active = Products.Where(product => product.Active).ToList();

        return Task.FromResult(active.Count == 0
            ? new PriceRange(0, 0)
            : new PriceRange(active.Min(p => p.PriceMinor), active.Max(p => p.PriceMinor)));
    }
}

public sealed class FakeCartRepository : ICartRepository
{
    public List<CartEntity> Carts { get; } = [];

    public int SaveCount { get; private set; }

    public Task<CartEntity?> FindAsync(CartOwner owner, CancellationToken cancellationToken) =>
        Task.FromResult(Match(owner));

    public Task<CartEntity> GetOrCreateAsync(CartOwner owner, CancellationToken cancellationToken)
    {
        var existing = Match(owner);
        if (existing is not null)
        {
            return Task.FromResult(existing);
        }

        var cart = new CartEntity
        {
            Id = Guid.NewGuid().ToString("N"),
            UserId = owner.UserId,
            AnonId = owner.AnonId,
        };

        Carts.Add(cart);
        return Task.FromResult(cart);
    }

    public void Remove(CartEntity cart) => Carts.Remove(cart);

    public Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        SaveCount++;
        return Task.CompletedTask;
    }

    private CartEntity? Match(CartOwner owner) =>
        Carts.FirstOrDefault(cart => owner.UserId is not null
            ? cart.UserId == owner.UserId
            : cart.AnonId == owner.AnonId);
}

public sealed class FakeOrderRepository : IOrderRepository
{
    public List<Order> Orders { get; } = [];

    public Task<Order?> FindByRequestIdAsync(string requestId, CancellationToken cancellationToken) =>
        Task.FromResult(Orders.FirstOrDefault(order => order.RequestId == requestId));

    public Task<Order?> FindByReferenceAsync(
        string reference,
        string? userId,
        bool guestAccessGranted,
        CancellationToken cancellationToken) =>
        Task.FromResult(Orders.FirstOrDefault(order =>
            order.Reference == reference &&
            ((userId is not null && order.UserId == userId) ||
                (guestAccessGranted && order.UserId is null))));

    public Task<IReadOnlyList<Order>> ListForUserAsync(string userId, CancellationToken cancellationToken)
    {
        IReadOnlyList<Order> results = Orders.Where(order => order.UserId == userId).ToList();
        return Task.FromResult(results);
    }

    public void Add(Order order) => Orders.Add(order);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}

/// <summary>Runs the action straight through; transactional behaviour is EF's job.</summary>
public sealed class FakeUnitOfWork : IUnitOfWork
{
    public Task<T> InTransactionAsync<T>(
        Func<CancellationToken, Task<T>> action,
        CancellationToken cancellationToken) => action(cancellationToken);
}

/// <summary>
/// Stores rows the way the table does — one per owner per product — so the
/// merge tests exercise real de-duplication rather than a mock's say-so.
/// </summary>
public sealed class FakeWishlistRepository(params Product[] catalogue) : IWishlistRepository
{
    public List<WishlistItem> Items { get; } = [];

    public Task<IReadOnlyList<WishlistItem>> ListAsync(
        CartOwner owner,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<WishlistItem> results = [.. Owned(owner).OrderByDescending(item => item.CreatedAt)];
        return Task.FromResult(results);
    }

    public Task<WishlistItem?> FindAsync(
        CartOwner owner,
        string productId,
        CancellationToken cancellationToken) =>
        Task.FromResult(Owned(owner).FirstOrDefault(item => item.ProductId == productId));

    /// <summary>
    /// Stores the row with its product attached, because the real repository
    /// Includes it and the service maps from that navigation. A fake that left
    /// it null would make every wishlist look empty — which is exactly what it
    /// did before this.
    /// </summary>
    public void Add(WishlistItem item) => Items.Add(new WishlistItem
    {
        Id = item.Id,
        UserId = item.UserId,
        AnonId = item.AnonId,
        ProductId = item.ProductId,
        CreatedAt = item.CreatedAt,
        Product = Array.Find(catalogue, product => product.Id == item.ProductId),
    });

    public void Remove(WishlistItem item) => Items.Remove(item);

    public Task MergeAsync(string anonId, string userId, CancellationToken cancellationToken)
    {
        var owned = Items
            .Where(item => item.UserId == userId)
            .Select(item => item.ProductId)
            .ToHashSet(StringComparer.Ordinal);

        foreach (var item in Items.Where(item => item.AnonId == anonId).ToList())
        {
            if (!owned.Add(item.ProductId))
            {
                Items.Remove(item);
                continue;
            }

            item.UserId = userId;
            item.AnonId = null;
        }

        return Task.CompletedTask;
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    private IEnumerable<WishlistItem> Owned(CartOwner owner) =>
        owner.UserId is not null
            ? Items.Where(item => item.UserId == owner.UserId)
            : Items.Where(item => item.AnonId == owner.AnonId);
}

/// <summary>Backs the admin service with the orders and products a test sets up.</summary>
public sealed class FakeAdminRepository(params Product[] catalogue) : IAdminRepository
{
    public List<Order> Orders { get; } = [];

    public List<Product> Products { get; } = [.. catalogue];

    public int SaveCount { get; private set; }

    public Task<PagedResult<Order>> ListOrdersAsync(
        OrderStatus? status,
        string? search,
        DateTimeOffset? placedFrom,
        DateTimeOffset? placedTo,
        int page,
        int perPage,
        CancellationToken cancellationToken)
    {
        var matching = Orders
            .Where(order => status is null || order.Status == status)
            .Where(order => string.IsNullOrWhiteSpace(search) || Matches(order, search.Trim()))
            .Where(order => placedFrom is null || order.CreatedAt >= placedFrom)
            .Where(order => placedTo is null || order.CreatedAt <= placedTo)
            .OrderByDescending(order => order.CreatedAt)
            .ToList();

        IReadOnlyList<Order> items = [.. matching.Skip((page - 1) * perPage).Take(perPage)];
        return Task.FromResult(new PagedResult<Order>(items, page, perPage, matching.Count));
    }

    /// <summary>The same fields the real repository searches, case-insensitive.</summary>
    private static bool Matches(Order order, string term) =>
        order.Reference.Contains(term, StringComparison.OrdinalIgnoreCase) ||
        order.FullName.Contains(term, StringComparison.OrdinalIgnoreCase) ||
        order.Email.Contains(term, StringComparison.OrdinalIgnoreCase) ||
        order.Phone.Contains(term, StringComparison.OrdinalIgnoreCase) ||
        order.City.Contains(term, StringComparison.OrdinalIgnoreCase);

    public Task<Order?> FindOrderAsync(string reference, CancellationToken cancellationToken) =>
        Task.FromResult(Orders.FirstOrDefault(order => order.Reference == reference));

    public Task<PagedResult<Product>> ListProductsAsync(
        string? search,
        int page,
        int perPage,
        CancellationToken cancellationToken)
    {
        // Inactive products included, as the real repository does: staff have to
        // be able to find one again to put it back.
        var matching = Products
            .Where(product => string.IsNullOrWhiteSpace(search) ||
                product.Name.Contains(search, StringComparison.OrdinalIgnoreCase) ||
                product.Slug.Contains(search, StringComparison.OrdinalIgnoreCase))
            .OrderBy(product => product.Name, StringComparer.Ordinal)
            .ToList();

        IReadOnlyList<Product> items = [.. matching.Skip((page - 1) * perPage).Take(perPage)];
        return Task.FromResult(new PagedResult<Product>(items, page, perPage, matching.Count));
    }

    public Task<Product?> FindProductAsync(string productId, CancellationToken cancellationToken) =>
        Task.FromResult(Products.FirstOrDefault(product => product.Id == productId));

    public Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        SaveCount++;
        return Task.CompletedTask;
    }
}

/// <summary>
/// Stands in for Hubtel. Records what it was asked to start and answers status
/// checks from whatever the test set, so the checkout and callback paths can be
/// exercised without touching the network.
/// </summary>
public sealed class FakePaymentGateway : IPaymentGateway
{
    public bool IsConfigured { get; set; } = true;

    /// <summary>Set to make StartAsync fail the way an unreachable provider does.</summary>
    public bool FailToStart { get; set; }

    public List<Order> Started { get; } = [];

    public PaymentStatus NextStatus { get; set; } =
        new(PaymentState.Pending, 0, null, null);

    public Task<PaymentSession> StartAsync(Order order, CancellationToken cancellationToken)
    {
        if (FailToStart)
        {
            throw new HttpRequestException("provider unreachable");
        }

        Started.Add(order);
        return Task.FromResult(
            new PaymentSession($"https://checkout.test/{order.Reference}", $"chk_{order.Reference}"));
    }

    public Task<PaymentStatus> GetStatusAsync(
        string clientReference,
        CancellationToken cancellationToken) => Task.FromResult(NextStatus);
}

/// <summary>
/// Campaigns held in lists. Stateful like the others, so a test can assert that
/// checkout actually moved a coupon's counter rather than that it called a mock.
/// </summary>
public sealed class FakePromotionRepository : IPromotionRepository
{
    public List<Promotion> Promotions { get; } = [];

    public List<Coupon> Coupons { get; } = [];

    public List<CouponRedemption> Redemptions { get; } = [];

    public FakePromotionRepository(params Coupon[] coupons) => Coupons.AddRange(coupons);

    public Task<IReadOnlyList<Promotion>> ListLiveAsync(
        DateTimeOffset now,
        CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<Promotion>>(
            [.. Promotions.Where(promotion => promotion.IsLive(now)).OrderBy(promotion => promotion.Priority)]);

    public Task<IReadOnlyList<Promotion>> ListAllAsync(CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<Promotion>>([.. Promotions]);

    public Task<Promotion?> FindPromotionAsync(string id, CancellationToken cancellationToken) =>
        Task.FromResult(Promotions.FirstOrDefault(promotion => promotion.Id == id));

    public void Add(Promotion promotion) => Promotions.Add(promotion);

    public void Remove(Promotion promotion) => Promotions.Remove(promotion);

    public Task<Coupon?> FindCouponAsync(string code, CancellationToken cancellationToken) =>
        Task.FromResult(Coupons.FirstOrDefault(coupon =>
            string.Equals(coupon.Code, code, StringComparison.OrdinalIgnoreCase)));

    public Task<Coupon?> FindCouponByIdAsync(string id, CancellationToken cancellationToken) =>
        Task.FromResult(Coupons.FirstOrDefault(coupon => coupon.Id == id));

    public Task<PagedResult<Coupon>> ListCouponsAsync(
        string? search,
        int page,
        int perPage,
        CancellationToken cancellationToken)
    {
        var matches = Coupons
            .Where(coupon => string.IsNullOrWhiteSpace(search)
                || coupon.Code.Contains(search, StringComparison.OrdinalIgnoreCase))
            .ToList();

        return Task.FromResult(new PagedResult<Coupon>(
            [.. matches.Skip((page - 1) * perPage).Take(perPage)],
            page,
            perPage,
            matches.Count));
    }

    public void Add(Coupon coupon) => Coupons.Add(coupon);

    public void Remove(Coupon coupon) => Coupons.Remove(coupon);

    public void Add(CouponRedemption redemption) => Redemptions.Add(redemption);

    // By id, not by reference: the lookup below hands back a rehydrated copy,
    // and List.Remove on a reference type would quietly match none of them.
    public void Remove(CouponRedemption redemption) =>
        Redemptions.RemoveAll(entry => entry.Id == redemption.Id);

    public Task<int> CountRedemptionsAsync(
        string couponId,
        string email,
        CancellationToken cancellationToken) =>
        Task.FromResult(Redemptions.Count(redemption =>
            redemption.CouponId == couponId
            && string.Equals(redemption.Email, email, StringComparison.OrdinalIgnoreCase)));

    public Task<CouponRedemption?> FindRedemptionForOrderAsync(
        string orderId,
        CancellationToken cancellationToken)
    {
        var found = Redemptions.FirstOrDefault(redemption => redemption.OrderId == orderId);

        // The real repository includes the coupon; the fake wires the same
        // navigation up so ReleaseRedemptionAsync has something to give back to.
        if (found is not null && found.Coupon is null)
        {
            var coupon = Coupons.FirstOrDefault(entry => entry.Id == found.CouponId);
            if (coupon is not null)
            {
                found = new CouponRedemption
                {
                    Id = found.Id,
                    CouponId = found.CouponId,
                    Coupon = coupon,
                    OrderId = found.OrderId,
                    UserId = found.UserId,
                    Email = found.Email,
                    AmountMinor = found.AmountMinor,
                };
            }
        }

        return Task.FromResult(found);
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
