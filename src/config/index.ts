import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const ConfigSchema = z.object({
  DATABASE_URL: z.string().url(),
  ANTHROPIC_API_KEY: z.string().min(1),
  ALPHA_VANTAGE_API_KEY: z.string().min(1),
  API_KEY_SALT: z.string().min(16),
  WEBHOOK_SIGNING_SECRET: z.string().min(16),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Config = z.infer<typeof ConfigSchema>;

let cachedConfig: Config | null = null;

/** Load and validate environment configuration. Fails fast if required vars are missing. */
export function loadConfig(): Config {
  if (cachedConfig) return cachedConfig;

  const result = ConfigSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${missing}`);
  }

  cachedConfig = result.data;
  return cachedConfig;
}

/** Get config (throws if not loaded) */
export function getConfig(): Config {
  if (!cachedConfig) {
    return loadConfig();
  }
  return cachedConfig;
}
