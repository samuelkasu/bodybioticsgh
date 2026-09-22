import { z } from "zod";

/**
 * The frontend holds no database credentials and no session secret — those
 * belong to the .NET API. What is left is the rendering server's own config,
 * still validated so a bad deploy fails at start rather than at first request.
 */
const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["local", "staging", "production"]).default("local"),
  /** Where /api/* is proxied to (see rewrites in next.config.ts). */
  API_ORIGIN: z.string().url().default("http://localhost:5080"),
});

const clientSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().default("/api"),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;

let cachedServerEnv: ServerEnv | undefined;

/**
 * Server-only. Called lazily so that importing a module in a Client Component
 * bundle never drags server configuration into the browser build.
 */
export function serverEnv(): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv;

  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid server environment:\n${issues}`);
  }

  cachedServerEnv = parsed.data;
  return cachedServerEnv;
}

// NEXT_PUBLIC_* values are inlined at build time, so they must be referenced
// as full literals rather than looked up dynamically on process.env.
export const clientEnv: ClientEnv = clientSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});
