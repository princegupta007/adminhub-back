export interface AppConfig {
  nodeEnv: string;
  port: number;
  host: string;
  database: {
    url: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  frontendUrl: string;
  throttle: {
    ttl: number;
    limit: number;
    loginLimit: number;
  };
  swagger: {
    enabled: boolean;
  };
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  host: process.env.HOST || '0.0.0.0',
  database: {
    url: process.env.DATABASE_URL || '',
  },
  jwt: {
    secret: process.env.JWT_SECRET || '',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },
  frontendUrl: process.env.FRONTEND_URL || '',
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL || '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
    loginLimit: parseInt(process.env.LOGIN_THROTTLE_LIMIT || '5', 10),
  },
  swagger: {
    enabled:
      process.env.SWAGGER_ENABLED !== undefined
        ? process.env.SWAGGER_ENABLED === 'true'
        : process.env.NODE_ENV !== 'production',
  },
});
