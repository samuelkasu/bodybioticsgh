using BodyBiotics.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BodyBiotics.Infrastructure.Persistence.Configurations;

internal sealed class CartConfiguration : IEntityTypeConfiguration<Cart>
{
    public void Configure(EntityTypeBuilder<Cart> builder)
    {
        builder.HasKey(cart => cart.Id);
        builder.Property(cart => cart.Id).HasMaxLength(32);
        builder.Property(cart => cart.UserId).HasMaxLength(32);
        builder.Property(cart => cart.AnonId).HasMaxLength(64);
        builder.Property(cart => cart.CouponCode).HasMaxLength(Coupon.MaxCodeLength);

        builder.Ignore(cart => cart.SubtotalMinor);
        builder.Ignore(cart => cart.ItemCount);

        builder
            .HasOne(cart => cart.User)
            .WithMany(user => user.Carts)
            .HasForeignKey(cart => cart.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(cart => cart.AnonId).IsUnique();
        builder.HasIndex(cart => cart.UserId);
    }
}

internal sealed class CartItemConfiguration : IEntityTypeConfiguration<CartItem>
{
    public void Configure(EntityTypeBuilder<CartItem> builder)
    {
        builder.HasKey(item => item.Id);
        builder.Property(item => item.Id).HasMaxLength(32);
        builder.Property(item => item.CartId).HasMaxLength(32).IsRequired();
        builder.Property(item => item.ProductId).HasMaxLength(32).IsRequired();

        builder.Ignore(item => item.LineTotalMinor);

        builder
            .HasOne(item => item.Cart)
            .WithMany(cart => cart.Items)
            .HasForeignKey(item => item.CartId)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .HasOne(item => item.Product)
            .WithMany(product => product.CartItems)
            .HasForeignKey(item => item.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        // One row per product per cart; merging an anonymous cart on sign-in
        // relies on this to upsert rather than duplicate.
        builder.HasIndex(item => new { item.CartId, item.ProductId }).IsUnique();
    }
}

internal sealed class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.HasKey(order => order.Id);
        builder.Property(order => order.Id).HasMaxLength(32);
        builder.Property(order => order.Reference).HasMaxLength(32).IsRequired();
        builder.Property(order => order.UserId).HasMaxLength(32);
        builder.Property(order => order.Email).HasMaxLength(320).IsRequired();
        // Lengths match CheckoutRequestValidator, so the database rejects what
        // the validator would have rejected even if something bypasses it.
        builder.Property(order => order.FullName).HasMaxLength(120).IsRequired();
        builder.Property(order => order.Phone).HasMaxLength(20).IsRequired();
        builder.Property(order => order.AddressLine).HasMaxLength(200).IsRequired();
        builder.Property(order => order.City).HasMaxLength(80).IsRequired();
        builder.Property(order => order.DeliveryZone).HasMaxLength(32).IsRequired();
        builder.Property(order => order.DeliveryZoneName).HasMaxLength(120).IsRequired();
        builder.Property(order => order.Notes).HasMaxLength(500);
        builder.Property(order => order.Currency).HasMaxLength(3).IsRequired();
        builder.Property(order => order.RequestId).HasMaxLength(64);
        builder.Property(order => order.Status).HasConversion<string>().HasMaxLength(16);
        builder.Property(order => order.PaymentMethod).HasConversion<string>().HasMaxLength(16);
        builder.Property(order => order.PaymentReference).HasMaxLength(64);
        builder.Property(order => order.PaymentCheckoutUrl).HasMaxLength(512);
        builder.Property(order => order.PaymentChannel).HasMaxLength(32);
        builder.Property(order => order.CouponCode).HasMaxLength(Coupon.MaxCodeLength);
        // Several campaign descriptions joined, so wider than any one of them.
        builder.Property(order => order.DiscountDescription).HasMaxLength(500);

        builder
            .HasOne(order => order.User)
            .WithMany(user => user.Orders)
            .HasForeignKey(order => order.UserId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(order => order.Reference).IsUnique();
        // The unique index is what actually enforces checkout idempotency.
        builder.HasIndex(order => order.RequestId).IsUnique();
        builder.HasIndex(order => new { order.UserId, order.CreatedAt });
        builder.HasIndex(order => order.Status);
        // Reconciliation reads by provider reference when a callback arrives
        // carrying only Hubtel's own id.
        builder.HasIndex(order => order.PaymentReference);
    }
}

internal sealed class OrderItemConfiguration : IEntityTypeConfiguration<OrderItem>
{
    public void Configure(EntityTypeBuilder<OrderItem> builder)
    {
        builder.HasKey(item => item.Id);
        builder.Property(item => item.Id).HasMaxLength(32);
        builder.Property(item => item.OrderId).HasMaxLength(32).IsRequired();
        builder.Property(item => item.ProductId).HasMaxLength(32).IsRequired();

        builder.Ignore(item => item.LineTotalMinor);
        builder.Ignore(item => item.DiscountedLineTotalMinor);

        builder
            .HasOne(item => item.Order)
            .WithMany(order => order.Items)
            .HasForeignKey(item => item.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        // Restrict: a product that has been sold cannot be deleted out from
        // under its receipts.
        builder
            .HasOne(item => item.Product)
            .WithMany(product => product.OrderItems)
            .HasForeignKey(item => item.ProductId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(item => item.OrderId);
    }
}
