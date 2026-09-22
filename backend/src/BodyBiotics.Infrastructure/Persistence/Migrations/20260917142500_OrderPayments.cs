using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BodyBiotics.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class OrderPayments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "paid_at",
                table: "orders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "payment_channel",
                table: "orders",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "payment_checkout_url",
                table: "orders",
                type: "character varying(512)",
                maxLength: 512,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "payment_method",
                table: "orders",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "payment_reference",
                table: "orders",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_orders_payment_reference",
                table: "orders",
                column: "payment_reference");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_orders_payment_reference",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "paid_at",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "payment_channel",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "payment_checkout_url",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "payment_method",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "payment_reference",
                table: "orders");
        }
    }
}
