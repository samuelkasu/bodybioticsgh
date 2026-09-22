using BodyBiotics.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BodyBiotics.Infrastructure.Persistence.Configurations;

internal sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.HasKey(user => user.Id);
        builder.Property(user => user.Id).HasMaxLength(32);
        builder.Property(user => user.Email).HasMaxLength(320).IsRequired();
        builder.Property(user => user.PasswordHash).HasMaxLength(256).IsRequired();
        builder.Property(user => user.Name).HasMaxLength(120);
        builder.Property(user => user.Phone).HasMaxLength(32);

        // Stored as text, not an int: a future reordering of the enum then
        // cannot silently promote every customer to admin.
        builder.Property(user => user.Role).HasConversion<string>().HasMaxLength(16);

        builder.HasIndex(user => user.Email).IsUnique();
    }
}

internal sealed class SessionConfiguration : IEntityTypeConfiguration<Session>
{
    public void Configure(EntityTypeBuilder<Session> builder)
    {
        builder.HasKey(session => session.Id);
        builder.Property(session => session.Id).HasMaxLength(32);
        builder.Property(session => session.UserId).HasMaxLength(32).IsRequired();
        builder.Property(session => session.UserAgent).HasMaxLength(512);
        builder.Property(session => session.Ip).HasMaxLength(64);

        builder
            .HasOne(session => session.User)
            .WithMany(user => user.Sessions)
            .HasForeignKey(session => session.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(session => session.UserId);
        // Supports the sweep that deletes expired rows.
        builder.HasIndex(session => session.ExpiresAt);
    }
}

internal sealed class PasswordResetTokenConfiguration : IEntityTypeConfiguration<PasswordResetToken>
{
    public void Configure(EntityTypeBuilder<PasswordResetToken> builder)
    {
        builder.HasKey(token => token.Id);
        builder.Property(token => token.Id).HasMaxLength(32);
        builder.Property(token => token.UserId).HasMaxLength(32).IsRequired();
        // 64 hex characters of SHA-256, fixed width.
        builder.Property(token => token.TokenHash).HasMaxLength(64).IsRequired();

        builder
            .HasOne(token => token.User)
            .WithMany()
            .HasForeignKey(token => token.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // The lookup the reset endpoint makes, and the only one: a token is
        // always found by its hash, never by user.
        builder.HasIndex(token => token.TokenHash).IsUnique();
        builder.HasIndex(token => token.ExpiresAt);
    }
}
