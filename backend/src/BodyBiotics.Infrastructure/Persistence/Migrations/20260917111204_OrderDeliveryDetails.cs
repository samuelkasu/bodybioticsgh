using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BodyBiotics.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class OrderDeliveryDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "address_line",
                table: "orders",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "city",
                table: "orders",
                type: "character varying(80)",
                maxLength: 80,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "full_name",
                table: "orders",
                type: "character varying(120)",
                maxLength: 120,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "notes",
                table: "orders",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "phone",
                table: "orders",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "address_line",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "city",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "full_name",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "notes",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "phone",
                table: "orders");
        }
    }
}
