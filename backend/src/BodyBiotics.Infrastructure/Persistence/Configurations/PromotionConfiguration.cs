using BodyBiotics.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BodyBiotics.Infrastructure.Persistence.Configurations;

internal sealed class CouponConfiguration : IEntityTypeConfiguration<Coupon>
{
    public void Configure(EntityTypeBuilder<Coupon> builder)
    {
        builder.HasKey(coupon => coupon.Id);
        builder.Property(coupon => coupon.Id).HasMaxLength(32);
        builder.Property(coupon => coupon.Code).HasMaxLength(Coupon.MaxCodeLength).IsRequired();
        builder.Property(coupon => coupon.Description).HasMaxLength(200).IsRequired();
        builder.Property(coupon => coupon.DiscountType).HasConversion<string>().HasMaxLength(16);
        builder.Property(coupon => coupon.Scope).HasConversion<string>().HasMaxLength(16);
        // Comma-separated slug lists, the same shape ProductTag uses.
        builder.Property(coupon => coupon.ScopeSlugs).HasMaxLength(1000);

        // One code, once. The unique index is what actually stops two coupons
        // called SUMMER20 existing after a double-tap on the admin form.
        builder.HasIndex(coupon => coupon.Code).IsUnique();
        builder.HasIndex(coupon => coupon.Active);

        builder.ToTable(table =>
        {
            table.HasCheckConstraint("ck_coupon_value_non_negative", "\"value\" >= 0");
            table.HasCheckConstraint(
                "ck_coupon_min_spend_non_negative",
                "\"min_spend_minor\" >= 0");
            table.HasCheckConstraint(
                "ck_coupon_times_used_non_negative",
                "\"times_used\" >= 0");
        });
    }
}

internal sealed class CouponRedemptionConfiguration : IEntityTypeConfiguration<CouponRedemption>
{
    public void Configure(EntityTypeBuilder<CouponRedemption> builder)
    {
        builder.HasKey(redemption => redemption.Id);
        builder.Property(redemption => redemption.Id).HasMaxLength(32);
        builder.Property(redemption => redemption.CouponId).HasMaxLength(32).IsRequired();
        builder.Property(redemption => redemption.OrderId).HasMaxLength(32).IsRequired();
        builder.Property(redemption => redemption.UserId).HasMaxLength(32);
        builder.Property(redemption => redemption.Email).HasMaxLength(320).IsRequired();

        builder
            .HasOne(redemption => redemption.Coupon)
            .WithMany(coupon => coupon.Redemptions)
            .HasForeignKey(redemption => redemption.CouponId)
            .OnDelete(DeleteBehavior.Cascade);

        // Restrict, not cascade: deleting an order is not something this system
        // does, and a redemption whose order vanished is a hole in the audit.
        builder
            .HasOne(redemption => redemption.Order)
            .WithMany()
            .HasForeignKey(redemption => redemption.OrderId)
            .OnDelete(DeleteBehavior.Restrict);

        // One redemption per order: this is what makes a replayed checkout
        // unable to burn a second use of the same code.
        builder.HasIndex(redemption => redemption.OrderId).IsUnique();
        // The per-customer limit reads this.
        builder.HasIndex(redemption => new { redemption.CouponId, redemption.Email });
    }
}

internal sealed class PromotionConfiguration : IEntityTypeConfiguration<Promotion>
{
    public void Configure(EntityTypeBuilder<Promotion> builder)
    {
        builder.HasKey(promotion => promotion.Id);
        builder.Property(promotion => promotion.Id).HasMaxLength(32);
        builder.Property(promotion => promotion.Name).HasMaxLength(120).IsRequired();
        builder.Property(promotion => promotion.Description).HasMaxLength(200).IsRequired();
        builder.Property(promotion => promotion.DiscountType).HasConversion<string>().HasMaxLength(16);
        builder.Property(promotion => promotion.Scope).HasConversion<string>().HasMaxLength(16);
        builder.Property(promotion => promotion.ScopeSlugs).HasMaxLength(1000);
        builder.Property(promotion => promotion.BannerText).HasMaxLength(200);

        // The storefront asks "what is live right now" on every cart read.
        builder.HasIndex(promotion => new { promotion.Active, promotion.Priority });

        builder.ToTable(table =>
        {
            table.HasCheckConstraint("ck_promotion_value_non_negative", "\"value\" >= 0");
            table.HasCheckConstraint(
                "ck_promotion_min_spend_non_negative",
                "\"min_spend_minor\" >= 0");
        });
    }
}
