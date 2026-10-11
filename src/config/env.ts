import { existsSync } from 'node:fs';
import { z } from 'zod';

const PLACEHOLDER_SECRET = /replace[-_ ]?with|change[-_ ]?me|your[-_ ]?secret|placeholder|example/i;

export const mongoUriSchema = z
  .string()
  .regex(/^mongodb(\+srv)?:\/\//, 'must be a mongodb:// or mongodb+srv:// URI');

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  MONGO_URI: mongoUriSchema,
  SEED_ON_STARTUP: z.stringbool().default(false),
  JWT_SECRET: z
    .string()
    .min(32)
    .refine((secret) => !PLACEHOLDER_SECRET.test(secret), 'is a placeholder; set a random value'),
  JWT_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
});

export type Env = z.infer<typeof envSchema>;

export function loadDotEnv(envFile = '.env'): void {
  if (existsSync(envFile)) process.loadEnvFile(envFile);
}

export function loadEnv(): Env {
  loadDotEnv();
  return parseEnv(process.env);
}

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `${issue.path.map(String).join('.')}: ${issue.message}`,
    );
    throw new Error(`Invalid environment configuration (${problems.join('; ')})`);
  }
  return result.data;
}
