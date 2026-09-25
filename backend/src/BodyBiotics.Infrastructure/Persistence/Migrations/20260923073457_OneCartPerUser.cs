using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BodyBiotics.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class OneCartPerUser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Folds any account that already has several carts into its most
            // recently touched one before the unique index goes on, which would
            // otherwise refuse to build. Nothing the customer chose is dropped:
            // a product in both carts has its quantities added (capped at the
            // per-line limit of 99), a product in only one moves across, and a
            // coupon survives if the kept cart had none.
            migrationBuilder.Sql("""
                CREATE TEMP TABLE cart_merge AS
                SELECT id AS extra_id,
                       first_value(id) OVER (PARTITION BY user_id ORDER BY updated_at DESC, id) AS keeper_id
                FROM carts
                WHERE user_id IS NOT NULL;

                DELETE FROM cart_merge WHERE extra_id = keeper_id;

                UPDATE cart_items kept
                SET quantity = LEAST(99, kept.quantity + moved.quantity)
                FROM (
                    SELECT m.keeper_id, i.product_id, SUM(i.quantity) AS quantity
                    FROM cart_items i
                    JOIN cart_merge m ON m.extra_id = i.cart_id
                    GROUP BY m.keeper_id, i.product_id
                ) moved
                WHERE kept.cart_id = moved.keeper_id AND kept.product_id = moved.product_id;

                INSERT INTO cart_items (id, cart_id, product_id, quantity)
                SELECT md5(random()::text || clock_timestamp()::text), moved.keeper_id, moved.product_id, LEAST(99, moved.quantity)
                FROM (
                    SELECT m.keeper_id, i.product_id, SUM(i.quantity) AS quantity
                    FROM cart_items i
                    JOIN cart_merge m ON m.extra_id = i.cart_id
                    GROUP BY m.keeper_id, i.product_id
                ) moved
                WHERE NOT EXISTS (
                    SELECT 1 FROM cart_items kept
                    WHERE kept.cart_id = moved.keeper_id AND kept.product_id = moved.product_id);

                UPDATE carts kept
                SET coupon_code = extra.coupon_code
                FROM (
                    SELECT m.keeper_id, MAX(c.coupon_code) AS coupon_code
                    FROM cart_merge m
                    JOIN carts c ON c.id = m.extra_id
                    GROUP BY m.keeper_id
                ) extra
                WHERE kept.id = extra.keeper_id AND kept.coupon_code IS NULL;

                DELETE FROM carts WHERE id IN (SELECT extra_id FROM cart_merge);

                DROP TABLE cart_merge;
                """);

            migrationBuilder.DropIndex(
                name: "ix_carts_user_id",
                table: "carts");

            migrationBuilder.CreateIndex(
                name: "ix_carts_user_id",
                table: "carts",
                column: "user_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_carts_user_id",
                table: "carts");

            migrationBuilder.CreateIndex(
                name: "ix_carts_user_id",
                table: "carts",
                column: "user_id");
        }
    }
}
