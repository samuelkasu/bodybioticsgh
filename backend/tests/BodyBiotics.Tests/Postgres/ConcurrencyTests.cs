using System.Data.Common;
using BodyBiotics.Api.Features.Checkout;
using BodyBiotics.Api.Features.Promotions;
using BodyBiotics.Api.Http;
using BodyBiotics.Domain.Abstractions;
using BodyBiotics.Domain.Common;
using BodyBiotics.Domain.Entities;
using BodyBiotics.Infrastructure.Persistence;
using BodyBiotics.Infrastructure.Repositories;
using BodyBiotics.Tests.Fakes;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace BodyBiotics.Tests.Postgres;

/// <summary>
/// Two requests changing the same rows at once, against a real Postgres. Each
/// of these loses data if the concurrency tokens or the cart index go away.
/// </summary>
public sealed class ConcurrencyTests
{
    [PostgresFact]
    public async Task EveryTokenedRowRefusesALostUpdate()
    {
        await using var database = await PostgresDatabase.CreateAsync();

        await using (var seed = database.NewContext())
        {
            var user = User("u1");
            seed.Users.Add(user);
            seed.Products.Add(Product("p1", stock: 5));
            seed.Coupons.Add(new Coupon { Id = "c1", Code = "LAST", Description = "Last use", Value = 10 });
            seed.Orders.Add(Order("o1"));
            seed.Carts.Add(new Cart { Id = "k1", UserId = user.Id });
            seed.PasswordResetTokens.Add(new PasswordResetToken
            {
                Id = "t1",
                UserId = user.Id,
                TokenHash = new string('a', 64),
                ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(30),
            });
            await seed.SaveChangesAsync();
        }

        await AssertSecondWriterLoses<Product>(database, "p1", product => product.TryReserve(1));
        await AssertSecondWriterLoses<Coupon>(database, "c1", coupon => coupon.TimesUsed++);
        await AssertSecondWriterLoses<Order>(database, "o1", order => order.TryTransitionTo(OrderStatus.Paid));
        await AssertSecondWriterLoses<Cart>(database, "k1", cart => cart.CouponCode = "LAST");
        await AssertSecondWriterLoses<PasswordResetToken>(database, "t1", token => token.UsedAt = DateTimeOffset.UtcNow);
    }

    [PostgresFact]
    public async Task TwoCheckoutsForTheLastUnitSellItOnce()
    {
        await using var database = await PostgresDatabase.CreateAsync();

        await using (var seed = database.NewContext())
        {
            seed.Products.Add(Product("p1", stock: 1));
            seed.Carts.Add(CartWith("k1", "anon-1", "p1"));
            seed.Carts.Add(CartWith("k2", "anon-2", "p1"));
            await seed.SaveChangesAsync();
        }

        // Both checkouts are held right after reading the stock until the
        // other has read it too, so they collide every run rather than
        // occasionally.
        var rendezvous = new Rendezvous(2);

        var outcomes = await Task.WhenAll(
            TryCheckoutAsync(database, rendezvous, "anon-1", "req-1"),
            TryCheckoutAsync(database, rendezvous, "anon-2", "req-2"));

        Assert.Single(outcomes, outcome => outcome is null);
        var refused = Assert.Single(outcomes, outcome => outcome is not null);
        // Refused with the real reason on the rerun, not a generic conflict.
        Assert.Contains("does not have 1 left", refused!.Message, StringComparison.Ordinal);

        await using var check = database.NewContext();
        Assert.Equal(0, (await check.Products.SingleAsync()).Stock);
        Assert.Equal(1, await check.Orders.CountAsync());
    }

    [PostgresFact]
    public async Task TwoFirstAddsForOneAccountShareOneCart()
    {
        await using var database = await PostgresDatabase.CreateAsync();

        await using (var seed = database.NewContext())
        {
            seed.Users.Add(User("u1"));
            await seed.SaveChangesAsync();
        }

        var owner = CartOwner.ForUser("u1");

        await using var first = database.NewContext();
        await using var second = database.NewContext();

        await using var firstTransaction = await first.Database.BeginTransactionAsync();
        var firstCart = await new CartRepository(first).GetOrCreateAsync(owner, default);

        var secondCart = Task.Run(async () =>
        {
            await using var transaction = await second.Database.BeginTransactionAsync();
            var cart = await new CartRepository(second).GetOrCreateAsync(owner, default);
            await transaction.CommitAsync();
            return cart;
        });

        // Held on the first one's uncommitted row, not racing past it.
        await Task.Delay(500);
        Assert.False(secondCart.IsCompleted);

        await firstTransaction.CommitAsync();

        Assert.Equal(firstCart.Id, (await secondCart).Id);

        await using var check = database.NewContext();
        Assert.Equal(1, await check.Carts.CountAsync(cart => cart.UserId == "u1"));
    }

    [PostgresFact]
    public async Task TheMigrationFoldsDuplicateCartsInsteadOfFailing()
    {
        await using var database = await PostgresDatabase.CreateAsync("ConcurrencyTokens");

        await using (var seed = database.NewContext())
        {
            seed.Users.Add(User("u1"));
            seed.Products.Add(Product("p1", stock: 100));
            seed.Products.Add(Product("p2", stock: 100));

            var older = CartWith("old", anonId: null, "p1", quantity: 5, userId: "u1");
            older.CouponCode = "WELCOME";
            older.Items.Add(new CartItem { Id = "old-p2", CartId = "old", ProductId = "p2", Quantity = 2 });
            seed.Carts.Add(older);
            seed.Carts.Add(CartWith("new", anonId: null, "p1", quantity: 97, userId: "u1"));
            await seed.SaveChangesAsync();

            // By hand: SaveChanges stamps UpdatedAt on everything it writes.
            await seed.Database.ExecuteSqlRawAsync(
                "UPDATE carts SET updated_at = now() - interval '2 days' WHERE id = 'old'");
        }

        await using (var migrate = database.NewContext())
        {
            await migrate.Database.MigrateAsync();
        }

        await using var check = database.NewContext();
        var cart = await check.Carts.Include(cart => cart.Items).SingleAsync();

        // The most recently touched cart is kept and nothing in the other is lost.
        Assert.Equal("new", cart.Id);
        Assert.Equal("WELCOME", cart.CouponCode);
        Assert.Equal(CartItem.MaxQuantityPerLine, cart.Items.Single(item => item.ProductId == "p1").Quantity);
        Assert.Equal(2, cart.Items.Single(item => item.ProductId == "p2").Quantity);
    }

    private static async Task AssertSecondWriterLoses<T>(
        PostgresDatabase database,
        string id,
        Action<T> change)
        where T : class
    {
        await using var first = database.NewContext();
        await using var second = database.NewContext();

        var mine = await first.Set<T>().FindAsync(id);
        var theirs = await second.Set<T>().FindAsync(id);

        change(mine!);
        change(theirs!);

        await first.SaveChangesAsync();
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => second.SaveChangesAsync());
    }

    /// <summary>Null when the order was placed, the refusal otherwise.</summary>
    private static async Task<ApiException?> TryCheckoutAsync(
        PostgresDatabase database,
        Rendezvous rendezvous,
        string anonId,
        string requestId)
    {
        await using var db = database.NewContext(
            retryOnFailure: true,
            new PauseAfterFirstStockRead(rendezvous));

        var service = new CheckoutService(
            new CartRepository(db),
            new ProductRepository(db),
            new OrderRepository(db),
            new UnitOfWork(db),
            new FakePaymentGateway(),
            new TestMail().Notifier,
            new PricingService(new PromotionRepository(db)),
            new CheckoutRequestValidator());

        try
        {
            await service.PlaceOrderAsync(
                CartOwner.ForAnonymous(anonId),
                null,
                new CheckoutRequest(
                    "customer@example.com",
                    "Ama Mensah",
                    "0241234567",
                    "12 Oxford Street",
                    "Accra",
                    null,
                    requestId,
                    "accra-central"),
                default);

            return null;
        }
        catch (ApiException refused)
        {
            return refused;
        }
    }

    private static User User(string id) => new()
    {
        Id = id,
        Email = $"{id}@example.com",
        PasswordHash = "hash",
    };

    private static Product Product(string id, int stock) => new()
    {
        Id = id,
        Slug = id,
        Name = $"Product {id}",
        Description = "Test product",
        PriceMinor = 12_500,
        ImageUrl = $"/catalog/{id}/main.webp",
        Stock = stock,
        Active = true,
    };

    private static Order Order(string id) => new()
    {
        Id = id,
        Reference = $"BB-TEST-{id}",
        Email = "ama@example.com",
        FullName = "Ama Mensah",
        Phone = "0241234567",
        AddressLine = "12 Oxford Street",
        City = "Accra",
        DeliveryZone = "accra-central",
        DeliveryZoneName = "Accra Central",
        RequestId = $"req-{id}",
    };

    private static Cart CartWith(
        string id,
        string? anonId,
        string productId,
        int quantity = 1,
        string? userId = null) => new()
    {
        Id = id,
        AnonId = anonId,
        UserId = userId,
        Items =
        [
            new CartItem
            {
                Id = $"{id}-{productId}",
                CartId = id,
                ProductId = productId,
                Quantity = quantity,
            },
        ],
    };

    private sealed class Rendezvous(int parties)
    {
        private readonly TaskCompletionSource _everyone =
            new(TaskCreationOptions.RunContinuationsAsynchronously);

        private int _arrived;

        public Task ArriveAsync()
        {
            if (Interlocked.Increment(ref _arrived) == parties)
            {
                _everyone.SetResult();
            }

            return _everyone.Task.WaitAsync(TimeSpan.FromSeconds(10));
        }
    }

    /// <summary>
    /// Holds a checkout after its first read of stock. Only the first: the
    /// rerun that follows a conflict must go straight through.
    /// </summary>
    private sealed class PauseAfterFirstStockRead(Rendezvous rendezvous) : DbCommandInterceptor
    {
        private bool _paused;

        public override async ValueTask<DbDataReader> ReaderExecutedAsync(
            DbCommand command,
            CommandExecutedEventData eventData,
            DbDataReader result,
            CancellationToken cancellationToken = default)
        {
            if (!_paused && command.CommandText.Contains("FROM products AS", StringComparison.Ordinal))
            {
                _paused = true;
                await rendezvous.ArriveAsync();
            }

            return result;
        }
    }
}
