using BodyBiotics.Api.Features.Admin;
using BodyBiotics.Api.Features.Promotions;
using BodyBiotics.Domain.Common;
using BodyBiotics.Domain.Entities;
using BodyBiotics.Infrastructure.Persistence;
using BodyBiotics.Infrastructure.Repositories;
using BodyBiotics.Tests.Fakes;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace BodyBiotics.Tests.Postgres;

public sealed class DeliveryAndRefundTests
{
    private const string Reference = "BB-TEST-DELIVERY";

    [PostgresFact]
    public async Task AWholeDeliveryAndRefundIsWrittenAndReadBack()
    {
        await using var database = await PostgresDatabase.CreateAsync();
        await SeedAsync(database, stock: 8);

        // A fresh context per step, as each is its own request.
        await RunAsync(database, service => service.DispatchAsync(
            Reference,
            new DispatchOrderRequest("COURIER", "Yaw", "0241112222", CourierName: "Yango"),
            default));
        await RunAsync(database, service => service.CompleteDeliveryAsync(
            Reference,
            new CompleteDeliveryRequest(25_000, "cash"),
            default));
        await RunAsync(database, service => service.RecordRefundAsync(
            Reference,
            new RecordRefundRequest(
                12_500,
                "MOBILE_MONEY",
                "One returned unopened",
                "MM-1",
                [new RestockLine("p1", 1)]),
            default));

        await using var check = database.NewContext();
        var order = await check.Orders
            .Include(order => order.Deliveries)
            .Include(order => order.Refunds)
            .Include(order => order.Items)
            .SingleAsync();

        Assert.Equal(OrderStatus.Fulfilled, order.Status);
        Assert.Equal(25_000, order.AmountPaidMinor);
        Assert.Equal(12_500, order.RefundedMinor);
        var trip = Assert.Single(order.Deliveries);
        Assert.Equal(DeliveryStatus.Delivered, trip.Status);
        Assert.Equal("Yango", trip.CourierName);
        Assert.Equal(25_000, trip.CollectedMinor);
        Assert.Equal("MM-1", Assert.Single(order.Refunds).Reference);
        Assert.Equal(1, Assert.Single(order.Items).RestockedQuantity);
        Assert.Equal(9, (await check.Products.SingleAsync()).Stock);
    }

    [PostgresFact]
    public async Task TwoRefundsEnteredAtOnceCannotBothFitUnderTheCeiling()
    {
        await using var database = await PostgresDatabase.CreateAsync();
        await SeedAsync(database, stock: 8, paid: true);

        // Two members of staff, each seeing GH₵250 refundable, each refunding 150.
        await using var first = database.NewContext();
        await using var second = database.NewContext();
        var mine = await first.Orders.Include(order => order.Refunds).SingleAsync();
        var theirs = await second.Orders.Include(order => order.Refunds).SingleAsync();

        Assert.True(mine.TryAddRefund(Refund(mine, 15_000)));
        Assert.True(theirs.TryAddRefund(Refund(theirs, 15_000)));

        await first.SaveChangesAsync();
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => second.SaveChangesAsync());

        await using var check = database.NewContext();
        Assert.Equal(15_000, (await check.Orders.SingleAsync()).RefundedMinor);
        Assert.Equal(1, await check.Refunds.CountAsync());
    }

    [PostgresFact]
    public async Task TheDatabaseRefusesWhatTheCodeShouldNeverWrite()
    {
        await using var database = await PostgresDatabase.CreateAsync();
        await SeedAsync(database, stock: 8, paid: true);
        await using var db = database.NewContext();

        // Refunded past what was paid.
        await AssertViolatesAsync(db, "UPDATE orders SET refunded_minor = amount_paid_minor + 1");
        // Restocked past what was ordered.
        await AssertViolatesAsync(db, "UPDATE order_items SET restocked_quantity = quantity + 1");

        // Two trips on the road for one order.
        await db.Database.ExecuteSqlRawAsync(
            "INSERT INTO deliveries (id, order_id, method, rider_name, rider_phone, status, dispatched_at) " +
            "SELECT 'd1', id, 'Rider', 'Kofi', '0241112222', 'OutForDelivery', now() FROM orders");
        await AssertViolatesAsync(
            db,
            "INSERT INTO deliveries (id, order_id, method, rider_name, rider_phone, status, dispatched_at) " +
            "SELECT 'd2', id, 'Rider', 'Ama', '0243334444', 'OutForDelivery', now() FROM orders");
    }

    [PostgresFact]
    public async Task TheMigrationRecordsWhatExistingOrdersWerePaid()
    {
        await using var database = await PostgresDatabase.CreateAsync("OneCartPerUser");

        await using (var seed = database.NewContext())
        {
            // The model is ahead of this schema, so rows go in by hand.
            await seed.Database.ExecuteSqlRawAsync("""
                INSERT INTO orders (id, reference, email, full_name, phone, address_line, city,
                    delivery_zone, delivery_zone_name, currency, status, payment_method,
                    subtotal_minor, discount_minor, delivery_fee_minor, total_minor, created_at, updated_at)
                SELECT 'o-' || s, 'BB-' || s, 'a@example.com', 'Ama', '0241234567', 'Street', 'Accra',
                    'accra-central', 'Accra', 'GHS', s, 'OnDelivery', 20000, 0, 5000, 25000, now(), now()
                FROM unnest(ARRAY['Pending', 'Paid', 'Fulfilled', 'Refunded', 'Cancelled']) AS s
                """);
        }

        await using (var migrate = database.NewContext())
        {
            await migrate.Database.MigrateAsync();
        }

        await using var check = database.NewContext();
        var orders = await check.Orders.ToDictionaryAsync(order => order.Id);

        Assert.Equal(0, orders["o-Pending"].AmountPaidMinor);
        Assert.Equal(25_000, orders["o-Paid"].AmountPaidMinor);
        Assert.Equal(25_000, orders["o-Fulfilled"].AmountPaidMinor);
        Assert.Equal(0, orders["o-Cancelled"].AmountPaidMinor);
        // Already refunded in full, so nothing is refundable a second time.
        Assert.Equal(0, orders["o-Refunded"].RefundableMinor);
    }

    private static async Task SeedAsync(PostgresDatabase database, int stock, bool paid = false)
    {
        await using var seed = database.NewContext();

        var product = new Product
        {
            Id = "p1",
            Slug = "p1",
            Name = "Glow Serum",
            Description = "Test product",
            PriceMinor = 12_500,
            ImageUrl = "/catalog/p1/main.webp",
            Stock = stock,
            Active = true,
        };

        var order = new Order
        {
            Id = "o1",
            Reference = Reference,
            Email = "ama@example.com",
            FullName = "Ama Mensah",
            Phone = "0241234567",
            AddressLine = "12 Oxford Street",
            City = "Accra",
            DeliveryZone = "accra-central",
            DeliveryZoneName = "Accra Central",
            TotalMinor = 25_000,
            Items =
            [
                new OrderItem
                {
                    Id = "i1",
                    OrderId = "o1",
                    ProductId = product.Id,
                    UnitPriceMinor = 12_500,
                    Quantity = 2,
                },
            ],
        };

        if (paid)
        {
            order.TryTransitionTo(OrderStatus.Paid);
            order.RecordPayment(25_000, DateTimeOffset.UtcNow);
        }

        seed.Products.Add(product);
        seed.Orders.Add(order);
        await seed.SaveChangesAsync();
    }

    private static async Task RunAsync(PostgresDatabase database, Func<AdminService, Task> step)
    {
        await using var db = database.NewContext();

        var service = new AdminService(
            new AdminRepository(db),
            new TestMail().Notifier,
            new PricingService(new PromotionRepository(db)),
            new UpdateOrderStatusRequestValidator(),
            new UpdateProductRequestValidator(),
            new DispatchOrderRequestValidator(),
            new CompleteDeliveryRequestValidator(),
            new FailDeliveryRequestValidator(),
            new RecordRefundRequestValidator());

        await step(service);
    }

    private static Refund Refund(Order order, int amountMinor) => new()
    {
        Id = Identifier.New(),
        OrderId = order.Id,
        AmountMinor = amountMinor,
        Reason = "Returned",
    };

    private static async Task AssertViolatesAsync(AppDbContext db, string sql)
    {
        var failure = await Assert.ThrowsAsync<PostgresException>(() => db.Database.ExecuteSqlRawAsync(sql));
        Assert.True(
            failure.SqlState is PostgresErrorCodes.CheckViolation or PostgresErrorCodes.UniqueViolation,
            $"Expected a constraint to refuse it, got {failure.SqlState}: {failure.MessageText}");
    }
}
