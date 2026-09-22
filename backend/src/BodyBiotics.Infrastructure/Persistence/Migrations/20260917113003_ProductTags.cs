using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BodyBiotics.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ProductTags : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "product_tags",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    slug = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    intro = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    category_slugs = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    brand_slugs = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    search = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    active = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_product_tags", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_product_tags_slug",
                table: "product_tags",
                column: "slug",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "product_tags");
        }
    }
}
