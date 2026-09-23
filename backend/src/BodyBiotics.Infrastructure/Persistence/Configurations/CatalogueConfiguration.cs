using BodyBiotics.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BodyBiotics.Infrastructure.Persistence.Configurations;

internal sealed class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> builder)
    {
        builder.HasKey(category => category.Id);
        builder.Property(category => category.Id).HasMaxLength(32);
        builder.Property(category => category.Slug).HasMaxLength(120).IsRequired();
        builder.Property(category => category.Name).HasMaxLength(120).IsRequired();

        builder.HasIndex(category => category.Slug).IsUnique();
    }
}

internal sealed class BrandConfiguration : IEntityTypeConfiguration<Brand>
{
    public void Configure(EntityTypeBuilder<Brand> builder)
    {
        builder.HasKey(brand => brand.Id);
        builder.Property(brand => brand.Id).HasMaxLength(32);
        builder.Property(brand => brand.Slug).HasMaxLength(160).IsRequired();
        builder.Property(brand => brand.Name).HasMaxLength(160).IsRequired();

        builder.HasIndex(brand => brand.Slug).IsUnique();
    }
}

internal sealed class ProductTagConfiguration : IEntityTypeConfiguration<ProductTag>
{
    public void Configure(EntityTypeBuilder<ProductTag> builder)
    {
        builder.HasKey(tag => tag.Id);
        builder.Property(tag => tag.Id).HasMaxLength(32);
        builder.Property(tag => tag.Slug).HasMaxLength(160).IsRequired();
        builder.Property(tag => tag.Name).HasMaxLength(160).IsRequired();
        builder.Property(tag => tag.Intro).HasMaxLength(400).IsRequired();
        // Comma-separated slug lists, so wide enough for a tag that spans a
        // whole region's brands.
        builder.Property(tag => tag.CategorySlugs).HasMaxLength(1000);
        builder.Property(tag => tag.BrandSlugs).HasMaxLength(1000);
        builder.Property(tag => tag.Search).HasMaxLength(80);

        builder.HasIndex(tag => tag.Slug).IsUnique();
    }
}

internal sealed class ProductImageConfiguration : IEntityTypeConfiguration<ProductImage>
{
    public void Configure(EntityTypeBuilder<ProductImage> builder)
    {
        builder.HasKey(image => image.Id);
        builder.Property(image => image.Id).HasMaxLength(32);
        builder.Property(image => image.ProductId).HasMaxLength(32).IsRequired();
        builder.Property(image => image.Url).HasMaxLength(512).IsRequired();

        builder
            .HasOne(image => image.Product)
            .WithMany(product => product.Images)
            .HasForeignKey(image => image.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(image => new { image.ProductId, image.SortOrder });
    }
}

internal sealed class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.HasKey(product => product.Id);
        builder.Property(product => product.Id).HasMaxLength(32);
        // 200, not 160: the slug is the URL the old WooCommerce site was
        // indexed under, so it cannot be shortened without losing the ranking
        // that made keeping it worthwhile. One imported product runs to 178
        // characters — WooCommerce allowed up to 200, and so must this.
        builder.Property(product => product.Slug).HasMaxLength(200).IsRequired();
        builder.Property(product => product.Name).HasMaxLength(250).IsRequired();
        builder.Property(product => product.Description).HasMaxLength(4000).IsRequired();
        builder.Property(product => product.Sku).HasMaxLength(64);
        builder.Property(product => product.Currency).HasMaxLength(3).IsRequired();
        builder.Property(product => product.ImageUrl).HasMaxLength(512).IsRequired();
        builder.Property(product => product.HoverImageUrl).HasMaxLength(512);

        // Computed from Stock; there is no column behind it.
        builder.Ignore(product => product.InStock);

        // Mapped onto Postgres's xmin system column, which moves on every write
        // to the row. Checkout reads stock, subtracts, and writes it back; with
        // this token two checkouts racing for the last unit no longer both
        // succeed — the second fails its update and is retried against the
        // stock the first one left.
        builder.Property<uint>("Version").IsRowVersion();

        builder
            .HasOne(product => product.Category)
            .WithMany(category => category.Products)
            .HasForeignKey(product => product.CategoryId)
            .OnDelete(DeleteBehavior.SetNull);

        builder
            .HasOne(product => product.Brand)
            .WithMany(brand => brand.Products)
            .HasForeignKey(product => product.BrandId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(product => product.Slug).IsUnique();
        // Matches the storefront's only list query: active products, newest first.
        builder.HasIndex(product => new { product.Active, product.CreatedAt });
        builder.HasIndex(product => product.CategoryId);
        builder.HasIndex(product => product.BrandId);
        // Price-range filtering on the shop page scans this.
        builder.HasIndex(product => product.PriceMinor);

        builder.ToTable(table =>
        {
            // Defence in depth: application code clamps these, the database
            // refuses to store a negative price or negative stock regardless.
            table.HasCheckConstraint("ck_product_price_minor_non_negative", "\"price_minor\" >= 0");
            table.HasCheckConstraint("ck_product_stock_non_negative", "\"stock\" >= 0");
        });
    }
}

internal sealed class ProductReviewConfiguration : IEntityTypeConfiguration<ProductReview>
{
    public void Configure(EntityTypeBuilder<ProductReview> builder)
    {
        builder.HasKey(review => review.Id);
        builder.Property(review => review.Id).HasMaxLength(32);
        builder.Property(review => review.ProductId).HasMaxLength(32).IsRequired();
        builder.Property(review => review.UserId).HasMaxLength(32).IsRequired();
        builder.Property(review => review.AuthorName).HasMaxLength(120).IsRequired();
        builder.Property(review => review.Comment).HasMaxLength(2000).IsRequired();
        builder.Property(review => review.PhotoUrl).HasMaxLength(512);

        builder
            .HasOne(review => review.Product)
            .WithMany(product => product.Reviews)
            .HasForeignKey(review => review.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .HasOne(review => review.User)
            .WithMany(user => user.Reviews)
            .HasForeignKey(review => review.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // One review per customer per product: the second submission edits the
        // first rather than adding a second vote to the average.
        builder.HasIndex(review => new { review.ProductId, review.UserId }).IsUnique();
        // The product page reads newest first.
        builder.HasIndex(review => new { review.ProductId, review.CreatedAt });

        builder.ToTable(table => table.HasCheckConstraint(
            "ck_product_review_rating_range", "\"rating\" BETWEEN 1 AND 5"));
    }
}
