using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BodyBiotics.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Promotions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "sale_ends_at",
                table: "products",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "sale_price_minor",
                table: "products",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "sale_starts_at",
                table: "products",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "coupon_code",
                table: "orders",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "discount_description",
                table: "orders",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "discount_minor",
                table: "orders",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "discount_minor",
                table: "order_items",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "list_price_minor",
                table: "order_items",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "coupon_code",
                table: "carts",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "coupons",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    description = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    discount_type = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    scope = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    scope_slugs = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    value = table.Column<int>(type: "integer", nullable: false),
                    max_discount_minor = table.Column<int>(type: "integer", nullable: true),
                    min_spend_minor = table.Column<int>(type: "integer", nullable: false),
                    min_quantity = table.Column<int>(type: "integer", nullable: false),
                    buy_quantity = table.Column<int>(type: "integer", nullable: false),
                    get_quantity = table.Column<int>(type: "integer", nullable: false),
                    starts_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ends_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    usage_limit = table.Column<int>(type: "integer", nullable: true),
                    usage_limit_per_customer = table.Column<int>(type: "integer", nullable: true),
                    times_used = table.Column<int>(type: "integer", nullable: false),
                    active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_coupons", x => x.id);
                    table.CheckConstraint("ck_coupon_min_spend_non_negative", "\"min_spend_minor\" >= 0");
                    table.CheckConstraint("ck_coupon_times_used_non_negative", "\"times_used\" >= 0");
                    table.CheckConstraint("ck_coupon_value_non_negative", "\"value\" >= 0");
                });

            migrationBuilder.CreateTable(
                name: "promotions",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    description = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    discount_type = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    scope = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    scope_slugs = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    value = table.Column<int>(type: "integer", nullable: false),
                    max_discount_minor = table.Column<int>(type: "integer", nullable: true),
                    min_spend_minor = table.Column<int>(type: "integer", nullable: false),
                    min_quantity = table.Column<int>(type: "integer", nullable: false),
                    buy_quantity = table.Column<int>(type: "integer", nullable: false),
                    get_quantity = table.Column<int>(type: "integer", nullable: false),
                    starts_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ends_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    active = table.Column<bool>(type: "boolean", nullable: false),
                    priority = table.Column<int>(type: "integer", nullable: false),
                    stackable = table.Column<bool>(type: "boolean", nullable: false),
                    banner_text = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_promotions", x => x.id);
                    table.CheckConstraint("ck_promotion_min_spend_non_negative", "\"min_spend_minor\" >= 0");
                    table.CheckConstraint("ck_promotion_value_non_negative", "\"value\" >= 0");
                });

            migrationBuilder.CreateTable(
                name: "coupon_redemptions",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    coupon_id = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    order_id = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    user_id = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    amount_minor = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_coupon_redemptions", x => x.id);
                    table.ForeignKey(
                        name: "fk_coupon_redemptions_coupons_coupon_id",
                        column: x => x.coupon_id,
                        principalTable: "coupons",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_coupon_redemptions_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_coupon_redemptions_coupon_id_email",
                table: "coupon_redemptions",
                columns: new[] { "coupon_id", "email" });

            migrationBuilder.CreateIndex(
                name: "ix_coupon_redemptions_order_id",
                table: "coupon_redemptions",
                column: "order_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_coupons_active",
                table: "coupons",
                column: "active");

            migrationBuilder.CreateIndex(
                name: "ix_coupons_code",
                table: "coupons",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_promotions_active_priority",
                table: "promotions",
                columns: new[] { "active", "priority" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "coupon_redemptions");

            migrationBuilder.DropTable(
                name: "promotions");

            migrationBuilder.DropTable(
                name: "coupons");

            migrationBuilder.DropColumn(
                name: "sale_ends_at",
                table: "products");

            migrationBuilder.DropColumn(
                name: "sale_price_minor",
                table: "products");

            migrationBuilder.DropColumn(
                name: "sale_starts_at",
                table: "products");

            migrationBuilder.DropColumn(
                name: "coupon_code",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "discount_description",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "discount_minor",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "discount_minor",
                table: "order_items");

            migrationBuilder.DropColumn(
                name: "list_price_minor",
                table: "order_items");

            migrationBuilder.DropColumn(
                name: "coupon_code",
                table: "carts");
        }
    }
}
