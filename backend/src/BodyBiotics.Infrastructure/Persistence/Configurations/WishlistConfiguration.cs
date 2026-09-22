using BodyBiotics.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BodyBiotics.Infrastructure.Persistence.Configurations;

internal sealed class WishlistItemConfiguration : IEntityTypeConfiguration<WishlistItem>
{
    public void Configure(EntityTypeBuilder<WishlistItem> builder)
    {
        builder.HasKey(item => item.Id);
        builder.Property(item => item.Id).HasMaxLength(32);
        builder.Property(item => item.UserId).HasMaxLength(32);
        builder.Property(item => item.AnonId).HasMaxLength(64);
        builder.Property(item => item.ProductId).HasMaxLength(32).IsRequired();

        builder
            .HasOne(item => item.User)
            .WithMany()
            .HasForeignKey(item => item.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .HasOne(item => item.Product)
            .WithMany()
            .HasForeignKey(item => item.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        // One row per product per owner. Two filtered unique indexes rather than
        // one over both columns: exactly one of UserId and AnonId is ever set,
        // and Postgres treats NULLs as distinct, so a combined index would let
        // the same product be saved twice.
        builder
            .HasIndex(item => new { item.UserId, item.ProductId })
            .IsUnique()
            .HasFilter("user_id IS NOT NULL");

        builder
            .HasIndex(item => new { item.AnonId, item.ProductId })
            .IsUnique()
            .HasFilter("anon_id IS NOT NULL");
    }
}
