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
        // One basket per account. Without it, two first "add" taps racing each
        // create a cart, and every later request picks one of the two at
        // random — items appear to vanish and come back.
        builder.HasIndex(cart => cart.UserId).IsUnique();

        // Every cart change also stamps UpdatedAt, so this row is written on
        // every edit and its xmin catches two edits racing — a double-tapped
        // add, two tabs, a checkout clearing the basket mid-edit.
        builder.Property<uint>("Version").IsRowVersion();
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

        // The status is moved by the payment callback, the order page's own
        // reconcile, and admins, any two of which can land together. Without a
        // token the last write wins: an admin's cancel can overwrite a payment
        // that just settled, or a refund a fulfilment.
        builder.Property<uint>("Version").IsRowVersion();

        builder.Ignore(order => order.RefundableMinor);
        builder.Ignore(order => order.ActiveDelivery);

        builder.ToTable(table =>
        {
            // The money rules, held by the database as well as by Order: no
            // negative figures, and never more refunded than was received.
            table.HasCheckConstraint("ck_order_amount_paid_non_negative", "\"amount_paid_minor\" >= 0");
            table.HasCheckConstraint(
                "ck_order_refunded_within_paid",
                "\"refunded_minor\" BETWEEN 0 AND \"amount_paid_minor\"");
        });
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

        builder.ToTable(table => table.HasCheckConstraint(
            "ck_order_item_restocked_within_quantity",
            "\"restocked_quantity\" BETWEEN 0 AND \"quantity\""));
    }
}

internal sealed class DeliveryConfiguration : IEntityTypeConfiguration<Delivery>
{
    public void Configure(EntityTypeBuilder<Delivery> builder)
    {
        builder.HasKey(delivery => delivery.Id);
        builder.Property(delivery => delivery.Id).HasMaxLength(32);
        builder.Property(delivery => delivery.OrderId).HasMaxLength(32).IsRequired();
        builder.Property(delivery => delivery.Method).HasConversion<string>().HasMaxLength(16);
        builder.Property(delivery => delivery.Status).HasConversion<string>().HasMaxLength(16);
        builder.Property(delivery => delivery.CourierName).HasMaxLength(80);
        builder.Property(delivery => delivery.RiderName).HasMaxLength(120).IsRequired();
        builder.Property(delivery => delivery.RiderPhone).HasMaxLength(20).IsRequired();
        builder.Property(delivery => delivery.Notes).HasMaxLength(500);
        builder.Property(delivery => delivery.FailureReason).HasMaxLength(500);
        builder.Property(delivery => delivery.CollectedVia).HasMaxLength(32);

        builder
            .HasOne(delivery => delivery.Order)
            .WithMany(order => order.Deliveries)
            .HasForeignKey(delivery => delivery.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        // One trip on the road per order, enforced where two dispatches racing
        // cannot both slip past it.
        builder
            .HasIndex(delivery => delivery.OrderId, "ix_deliveries_order_id_out_for_delivery")
            .IsUnique()
            .HasFilter("\"status\" = 'OutForDelivery'")
            .HasDatabaseName("ix_deliveries_order_id_out_for_delivery");
        builder
            .HasIndex(delivery => delivery.OrderId, "ix_deliveries_order_id")
            .HasDatabaseName("ix_deliveries_order_id");

        builder.ToTable(table => table.HasCheckConstraint(
            "ck_delivery_collected_positive",
            "\"collected_minor\" IS NULL OR \"collected_minor\" > 0"));
    }
}

internal sealed class RefundConfiguration : IEntityTypeConfiguration<Refund>
{
    public void Configure(EntityTypeBuilder<Refund> builder)
    {
        builder.HasKey(refund => refund.Id);
        builder.Property(refund => refund.Id).HasMaxLength(32);
        builder.Property(refund => refund.OrderId).HasMaxLength(32).IsRequired();
        builder.Property(refund => refund.Method).HasConversion<string>().HasMaxLength(16);
        builder.Property(refund => refund.Reason).HasMaxLength(500).IsRequired();
        builder.Property(refund => refund.Reference).HasMaxLength(64);

        // Restrict, unlike deliveries: a refund is a financial record, and
        // deleting the order must not quietly take it along.
        builder
            .HasOne(refund => refund.Order)
            .WithMany(order => order.Refunds)
            .HasForeignKey(refund => refund.OrderId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(refund => refund.OrderId);

        builder.ToTable(table =>
        {
            table.HasCheckConstraint("ck_refund_amount_positive", "\"amount_minor\" > 0");
            table.HasCheckConstraint("ck_refund_restocked_non_negative", "\"restocked_units\" >= 0");
        });
    }
}
