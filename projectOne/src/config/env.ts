// Environment configuration
export const config = {
  port: Bun.env.PORT ? parseInt(Bun.env.PORT) : 3000,
  env: Bun.env.NODE_ENV || 'development',
  logLevel: Bun.env.LOG_LEVEL || 'info',
  isDevelopment: (Bun.env.NODE_ENV || 'development') === 'development',
  isProduction: (Bun.env.NODE_ENV || 'development') === 'production',
};

export default config;
