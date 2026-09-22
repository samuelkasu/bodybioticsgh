/**
 * Structured data block. The one place in the app that writes raw HTML, because
 * schema.org markup has to be a `<script type="application/ld+json">` element —
 * there is no React-idiomatic alternative.
 *
 * The `<` escape is what makes that safe: a product name or description
 * containing `</script>` would otherwise close the block early and turn
 * catalogue text into markup. Keep it.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
