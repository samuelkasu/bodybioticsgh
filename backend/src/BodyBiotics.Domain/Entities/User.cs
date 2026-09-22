namespace BodyBiotics.Domain.Entities;

public enum UserRole
{
    Customer = 0,
    Admin = 1,
}

public sealed class User
{
    public required string Id { get; init; }
    public required string Email { get; set; }
    public required string PasswordHash { get; set; }
    public string? Name { get; set; }
    public string? Phone { get; set; }
    public UserRole Role { get; set; } = UserRole.Customer;
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<Session> Sessions { get; init; } = [];
    public ICollection<Order> Orders { get; init; } = [];
    public ICollection<Cart> Carts { get; init; } = [];
    public ICollection<ProductReview> Reviews { get; init; } = [];
}
