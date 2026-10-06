import Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'provision')
    .default('development'),
  PORT: Joi.number().port().default(4000),
  HOST: Joi.string().default('0.0.0.0'),
  DATABASE_URL: Joi.string().required().messages({
    'any.required': 'DATABASE_URL is a required environment variable',
    'string.empty': 'DATABASE_URL cannot be empty',
  }),
  JWT_SECRET: Joi.string().min(16).required().messages({
    'any.required': 'JWT_SECRET is a required environment variable',
    'string.empty': 'JWT_SECRET cannot be empty',
    'string.min': 'JWT_SECRET must be at least 16 characters long for security',
  }),
  JWT_EXPIRES_IN: Joi.string().default('1d'),
  CORS_ORIGIN: Joi.string().optional(),
  FRONTEND_URL: Joi.string().when('CORS_ORIGIN', {
    is: Joi.exist(),
    // oxlint-disable-next-line unicorn/no-thenable
    then: Joi.optional().default(Joi.ref('CORS_ORIGIN')),
    otherwise: Joi.required().messages({
      'any.required': 'FRONTEND_URL is a required environment variable',
      'string.empty': 'FRONTEND_URL cannot be empty',
    }),
  }),
  THROTTLE_TTL: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(100),
  LOGIN_THROTTLE_LIMIT: Joi.number().default(5),
  SWAGGER_ENABLED: Joi.boolean().optional(),
});

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const { error, value } = envValidationSchema.validate(config, {
    abortEarly: false,
    allowUnknown: true,
  });

  if (error) {
    throw new Error(`Environment validation failed: ${error.message}`);
  }

  return value as Record<string, unknown>;
}
