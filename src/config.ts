export interface Config {
  database: DatabaseConfig;
  jwt: JWTConfig;
  server: ServerConfig;
  encryption: EncryptionConfig;
}

export interface DatabaseConfig {
  type: string;
  database: string;
  synchronize: boolean;
  logging: boolean;
}

export interface JWTConfig {
  secret: string;
  expiresIn: string;
}

export interface ServerConfig {
  port: number;
  nodeEnv: string;
  allowedOrigins: string[];
}

export interface EncryptionConfig {
  databaseMasterKey: string;
}

function config(): Config {
  // Validate required encryption key
  const masterKey = process.env.DATABASE_MASTER_KEY;
  if (!masterKey) {
    throw new Error(
      'DATABASE_MASTER_KEY environment variable is required for database encryption. ' +
      'Generate one using: openssl rand -hex 32'
    );
  }
  if (masterKey.length !== 64) {
    throw new Error('DATABASE_MASTER_KEY must be 64 characters (32 bytes) in hex format');
  }

  return {
    database: {
      type: process.env.DATABASE_TYPE || 'sqlite',
      database: process.env.DATABASE_PATH || 'encrypted-relay.db',
      synchronize: process.env.DATABASE_SYNCHRONIZE === 'true' || true,
      logging: process.env.DATABASE_LOGGING === 'true' || false,
    },
    jwt: {
      secret: process.env.JWT_SECRET || 'secure-jwt-secret-key-change-in-production',
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    },
    server: {
      port: parseInt(process.env.PORT || '') || 3000,
      nodeEnv: process.env.NODE_ENV || 'development',
      allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001').split(','),
    },
    encryption: {
      databaseMasterKey: masterKey,
    },
  };
}

// Helper functions for common environment checks
export function isDevelopment(): boolean {
  return (process.env.NODE_ENV || 'development') === 'development';
}

export function isProduction(): boolean {
  return (process.env.NODE_ENV || 'development') === 'production';
}

export default config;