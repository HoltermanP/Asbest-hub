import { z } from "zod";

const optionalString = z.string().min(1).optional();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: optionalString,
  OPENAI_API_KEY: optionalString,
  AI_MODEL_REASONING: z.string().default("claude-sonnet-4-6"),
  AI_MODEL_FAST: z.string().default("claude-haiku-4-5"),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-large"),
  UPSTASH_REDIS_REST_URL: optionalString,
  UPSTASH_REDIS_REST_TOKEN: optionalString,
  QSTASH_TOKEN: optionalString,
  QSTASH_CURRENT_SIGNING_KEY: optionalString,
  QSTASH_NEXT_SIGNING_KEY: optionalString,
  BLOB_READ_WRITE_TOKEN: optionalString,
  RESEND_API_KEY: optionalString,
  EMAIL_FROM: z.string().default("AsbestHub <noreply@example.com>"),
  APP_URL: z.string().default("http://localhost:3000"),
  CRON_SECRET: optionalString,
  LOCAL_STORAGE_DIR: z.string().default(".local-storage"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/** Validated environment. Throws with a readable message on first access when required variables are missing. */
export function env(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Ongeldige omgevingsvariabelen: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
