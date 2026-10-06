import { describe, expect, it } from 'vitest';
import { validateEnv } from './validation.js';

describe('Environment Validation (validateEnv)', () => {
  const validBaseConfig = {
    NODE_ENV: 'development',
    PORT: '4000',
    HOST: '0.0.0.0',
    DATABASE_URL:
      'postgresql://postgres:postgres@localhost:5432/miles_admin_dev',
    JWT_SECRET: 'production-quality-long-secret-key-32-chars',
    JWT_EXPIRES_IN: '1d',
    FRONTEND_URL: 'http://localhost:3000',
    THROTTLE_TTL: '60',
    THROTTLE_LIMIT: '100',
    LOGIN_THROTTLE_LIMIT: '5',
  };

  it('should validate and parse valid environment configuration successfully', () => {
    const result = validateEnv(validBaseConfig);
    expect(result.PORT).toBe(4000);
    expect(result.HOST).toBe('0.0.0.0');
    expect(result.JWT_SECRET).toBe(
      'production-quality-long-secret-key-32-chars',
    );
    expect(result.NODE_ENV).toBe('development');
  });

  it('should throw Error when DATABASE_URL is missing or empty', () => {
    const invalidConfig = { ...validBaseConfig, DATABASE_URL: '' };
    expect(() => validateEnv(invalidConfig)).toThrow(
      /DATABASE_URL cannot be empty/,
    );
  });

  it('should throw Error when JWT_SECRET is missing', () => {
    const { JWT_SECRET: _secret, ...rest } = validBaseConfig;
    expect(() => validateEnv(rest)).toThrow(
      /JWT_SECRET is a required environment variable/,
    );
  });

  it('should throw Error when JWT_SECRET is less than 16 characters', () => {
    const shortSecretConfig = {
      ...validBaseConfig,
      JWT_SECRET: 'short-secret',
    };
    expect(() => validateEnv(shortSecretConfig)).toThrow(
      /JWT_SECRET must be at least 16 characters long for security/,
    );
  });

  it('should throw Error when FRONTEND_URL is missing', () => {
    const { FRONTEND_URL: _url, ...rest } = validBaseConfig;
    expect(() => validateEnv(rest)).toThrow(
      /FRONTEND_URL is a required environment variable/,
    );
  });

  it('should apply sensible defaults when THROTTLE parameters are omitted', () => {
    const {
      THROTTLE_LIMIT: _limit,
      THROTTLE_TTL: _ttl,
      LOGIN_THROTTLE_LIMIT: _loginLimit,
      ...rest
    } = validBaseConfig;
    const result = validateEnv(rest);
    expect(result.THROTTLE_LIMIT).toBe(100);
    expect(result.THROTTLE_TTL).toBe(60);
    expect(result.LOGIN_THROTTLE_LIMIT).toBe(5);
  });

  it('should throw Error when THROTTLE parameter is not a number', () => {
    const invalidConfig = {
      ...validBaseConfig,
      THROTTLE_LIMIT: 'invalid-number',
    };
    expect(() => validateEnv(invalidConfig)).toThrow(
      /"THROTTLE_LIMIT" must be a number/,
    );
  });

  it('should parse optional SWAGGER_ENABLED flag', () => {
    const withSwagger = { ...validBaseConfig, SWAGGER_ENABLED: true };
    const result = validateEnv(withSwagger);
    expect(result.SWAGGER_ENABLED).toBe(true);
  });

  it('should accept CORS_ORIGIN when FRONTEND_URL is omitted and default FRONTEND_URL to CORS_ORIGIN', () => {
    const { FRONTEND_URL: _url, ...rest } = validBaseConfig;
    const withCorsOrigin = {
      ...rest,
      CORS_ORIGIN: 'https://miles-flax.vercel.app',
    };
    const result = validateEnv(withCorsOrigin);
    expect(result.FRONTEND_URL).toBe('https://miles-flax.vercel.app');
  });
});
