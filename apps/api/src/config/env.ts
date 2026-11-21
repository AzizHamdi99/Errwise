import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  API_PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  WEB_URL: z.string().url().default('http://localhost:3000'),
  MAIL_DRIVER: z.enum(['console', 'resend', 'smtp']).default('console'),
  MAIL_FROM: z.string().default('Errwise <onboarding@resend.dev>'),
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  INVITATION_TTL_DAYS: z.coerce.number().int().positive().default(7),
  EMAIL_VERIFICATION_TTL_HOURS: z.coerce.number().int().positive().default(24),
  EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60),
  INGEST_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(300),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),
  RABBITMQ_URL: z.string().url().optional(),
  ALERT_DELIVERY: z.enum(['queue', 'direct']).default('queue'),
  GITHUB_APP_ID: z.string().min(1),
  GITHUB_APP_SLUG: z.string().min(1),
  GITHUB_APP_CLIENT_ID: z.string().min(1),
  GITHUB_APP_CLIENT_SECRET: z.string().min(1),
  GITHUB_APP_PRIVATE_KEY_BASE64: z.string().min(32),
  GITHUB_STATE_SECRET: z.string().min(32),
  GITHUB_WEBHOOK_SECRET: z.string().min(16),
  // AI analysis is off until both are set, so the API can ship before the AI service does.
  AI_SERVICE_URL: z.string().url().optional(),
  AI_SERVICE_SECRET: z.string().min(16).optional(),
  AI_SERVICE_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(120_000)
    .default(45_000),
  AI_DAILY_LIMIT_PER_ORG: z.coerce.number().int().positive().default(20),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${details}`);
  }
  if (parsed.data.MAIL_DRIVER === 'resend' && !parsed.data.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is required when MAIL_DRIVER=resend');
  }
  if (
    parsed.data.MAIL_DRIVER === 'smtp' &&
    !(parsed.data.SMTP_HOST && parsed.data.SMTP_USER && parsed.data.SMTP_PASS)
  ) {
    throw new Error(
      'SMTP_HOST, SMTP_USER and SMTP_PASS are required when MAIL_DRIVER=smtp',
    );
  }
  if (!parsed.data.AI_SERVICE_URL !== !parsed.data.AI_SERVICE_SECRET) {
    throw new Error(
      'AI_SERVICE_URL and AI_SERVICE_SECRET must be set together, or both left out',
    );
  }
  if (parsed.data.ALERT_DELIVERY === 'queue' && !parsed.data.RABBITMQ_URL) {
    throw new Error('RABBITMQ_URL is required when ALERT_DELIVERY=queue');
  }
  return parsed.data;
}
