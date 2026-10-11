import { existsSync } from 'node:fs';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  MONGO_URI: z
    .string()
    .regex(/^mongodb(\+srv)?:\/\//, 'must be a mongodb:// or mongodb+srv:// URI'),
  SEED_ON_STARTUP: z.stringbool().default(false),
  JWT_SECRET: z.string().min(32),
  JWT_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(envFile = '.env'): Env {
  if (existsSync(envFile)) process.loadEnvFile(envFile);
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
