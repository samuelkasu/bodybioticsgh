using System.Net.Http.Headers;
using BodyBiotics.Domain.Abstractions;
using BodyBiotics.Infrastructure.Email;
using BodyBiotics.Infrastructure.Payments;
using BodyBiotics.Infrastructure.Persistence;
using BodyBiotics.Infrastructure.Repositories;
using BodyBiotics.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace BodyBiotics.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        string connectionString,
        IConfiguration configuration)
    {
        services.AddDbContext<AppDbContext>(options =>
        {
            options
                .UseNpgsql(connectionString, npgsql =>
                {
                    // Mobile Money traffic spikes and a managed Postgres can
                    // drop a connection; retry the transient cases rather than
                    // failing a checkout.
                    npgsql.EnableRetryOnFailure(3, TimeSpan.FromSeconds(2), null);
                    npgsql.MigrationsHistoryTable("__ef_migrations_history");
                })
                // snake_case columns: the schema stays readable from psql and
                // matches every other Postgres tool the team will reach for.
                .UseSnakeCaseNamingConvention();
        });

        services.AddScoped<IPasswordHasher, IdentityPasswordHasher>();

        services.AddScoped<IProductRepository, ProductRepository>();
        services.AddScoped<ICategoryRepository, CategoryRepository>();
        services.AddScoped<IBrandRepository, BrandRepository>();
        services.AddScoped<IProductTagRepository, ProductTagRepository>();
        services.AddScoped<ICartRepository, CartRepository>();
        services.AddScoped<IOrderRepository, OrderRepository>();
        services.AddScoped<IWishlistRepository, WishlistRepository>();
        services.AddScoped<IAdminRepository, AdminRepository>();
        services.AddScoped<IPromotionRepository, PromotionRepository>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        services.AddOptions<HubtelOptions>()
            .Bind(configuration.GetSection(HubtelOptions.SectionName));

        services.AddOptions<EmailOptions>()
            .Bind(configuration.GetSection(EmailOptions.SectionName));

        // Singleton: the background dispatcher that owns it is one, and the
        // sender holds no per-request state — a connection is opened and closed
        // inside SendAsync.
        services.AddSingleton<IEmailSender, SmtpEmailSender>();

        // Typed client: pooled handlers, and a timeout short enough that a
        // stalled provider cannot hold a checkout request open indefinitely.
        services.AddHttpClient<IPaymentGateway, HubtelPaymentGateway>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(20);
            client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        });

        return services;
    }
}
