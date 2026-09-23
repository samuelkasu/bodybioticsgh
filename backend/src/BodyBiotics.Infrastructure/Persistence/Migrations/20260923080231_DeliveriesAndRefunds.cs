using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BodyBiotics.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class DeliveriesAndRefunds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "amount_paid_minor",
                table: "orders",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "refunded_minor",
                table: "orders",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "restocked_quantity",
                table: "order_items",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "deliveries",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    order_id = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    method = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    courier_name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    rider_name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    rider_phone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    dispatched_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    delivered_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    failed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    failure_reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    collected_minor = table.Column<int>(type: "integer", nullable: true),
                    collected_via = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_deliveries", x => x.id);
                    table.CheckConstraint("ck_delivery_collected_positive", "\"collected_minor\" IS NULL OR \"collected_minor\" > 0");
                    table.ForeignKey(
                        name: "fk_deliveries_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "refunds",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    order_id = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    amount_minor = table.Column<int>(type: "integer", nullable: false),
                    reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    method = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    reference = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    restocked_units = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_refunds", x => x.id);
                    table.CheckConstraint("ck_refund_amount_positive", "\"amount_minor\" > 0");
                    table.CheckConstraint("ck_refund_restocked_non_negative", "\"restocked_units\" >= 0");
                    table.ForeignKey(
                        name: "fk_refunds_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            // Orders paid before the amount was stored. Every one of them was
            // paid in full — Hubtel's figure is checked against the total, and
            // staff marking paid meant the total — so the total is what came in.
            // A Refunded order predates refund records and was refunded in full;
            // recording that keeps it from reading as refundable a second time.
            migrationBuilder.Sql("""
                UPDATE orders
                SET amount_paid_minor = total_minor
                WHERE status IN ('Paid', 'Fulfilled', 'Refunded');

                UPDATE orders
                SET refunded_minor = total_minor
                WHERE status = 'Refunded';
                """);

            migrationBuilder.AddCheckConstraint(
                name: "ck_order_amount_paid_non_negative",
                table: "orders",
                sql: "\"amount_paid_minor\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "ck_order_refunded_within_paid",
                table: "orders",
                sql: "\"refunded_minor\" BETWEEN 0 AND \"amount_paid_minor\"");

            migrationBuilder.AddCheckConstraint(
                name: "ck_order_item_restocked_within_quantity",
                table: "order_items",
                sql: "\"restocked_quantity\" BETWEEN 0 AND \"quantity\"");

            migrationBuilder.CreateIndex(
                name: "ix_deliveries_order_id",
                table: "deliveries",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "ix_deliveries_order_id_out_for_delivery",
                table: "deliveries",
                column: "order_id",
                unique: true,
                filter: "\"status\" = 'OutForDelivery'");

            migrationBuilder.CreateIndex(
                name: "ix_refunds_order_id",
                table: "refunds",
                column: "order_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "deliveries");

            migrationBuilder.DropTable(
                name: "refunds");

            migrationBuilder.DropCheckConstraint(
                name: "ck_order_amount_paid_non_negative",
                table: "orders");

            migrationBuilder.DropCheckConstraint(
                name: "ck_order_refunded_within_paid",
                table: "orders");

            migrationBuilder.DropCheckConstraint(
                name: "ck_order_item_restocked_within_quantity",
                table: "order_items");

            migrationBuilder.DropColumn(
                name: "amount_paid_minor",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "refunded_minor",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "restocked_quantity",
                table: "order_items");
        }
    }
}
