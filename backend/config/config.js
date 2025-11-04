const path = require('path');
const fs = require('fs');

// Load environment variables
const envPath = process.env.NODE_ENV === 'production' 
  ? '.env' 
  : fs.existsSync('.env.local') ? '.env.local' : '.env';

require('dotenv').config({ path: envPath });

const config = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    apiUrl: process.env.API_URL || '',
    trustProxyHops: parseInt(process.env.TRUST_PROXY_HOPS || '0', 10),
    allowTestRunner: process.env.ALLOW_TEST_RUNNER === 'true',
    env: process.env.NODE_ENV || 'development'
  },
  
  database: {
    url: process.env.DATABASE_URL,
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'mundoxyz',
    poolMax: parseInt(process.env.PGPOOL_MAX || '10', 10),
    poolIdleMs: parseInt(process.env.PGPOOL_IDLE_MS || '30000', 10),
    sslMode: process.env.PGSSLMODE || 'disable'
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB || '0', 10)
  },
  
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    botUsername: process.env.TELEGRAM_BOT_USERNAME || '',
    toteId: process.env.TOTE_TG_ID || '1417856820',
    authMaxSkewSec: parseInt(process.env.TELEGRAM_AUTH_MAX_SKEW_SEC || '86400', 10),
    replayTtlSec: parseInt(process.env.TELEGRAM_REPLAY_TTL_SEC || '120', 10),
    allowUnverifiedInit: process.env.ALLOW_UNVERIFIED_TG_INIT === 'true',
    webappUrl: process.env.PUBLIC_WEBAPP_URL || 'http://localhost:3000'
  },
  
  security: {
    jwtSecret: process.env.JWT_SECRET || 'change-this-secret-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    sessionSecret: process.env.SESSION_SECRET || 'change-this-session-secret',
    cookieSecure: process.env.COOKIE_SECURE === 'true',
    cookieDomain: process.env.COOKIE_DOMAIN || 'localhost',
    rateLimit: {
      windowMs: parseInt(process.env.RL_WINDOW_MS || '60000', 10),
      maxRequests: parseInt(process.env.RL_MAX_REQ || '500', 10)
    }
  },
  
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    code: process.env.ADMIN_CODE || ''
  },
  
  roles: {
    toteUserIds: (process.env.ROLE_TOTE_USER_IDS || '').split(',').filter(Boolean),
    adminUserIds: (process.env.ROLE_ADMIN_USER_IDS || '').split(',').filter(Boolean),
    toteId: process.env.TOTE_ID || ''
  },
  
  features: {
    tttV2: process.env.TTT_V2 === 'true',
    tttDbWallet: process.env.TTT_DB_WALLET === 'true',
    welcomeAutostart: process.env.WELCOME_AUTOSTART === 'true',
    economyDevAutoSeed: process.env.ECONOMY_DEV_AUTO_SEED === 'true',
    economyDevSeedCoins: parseInt(process.env.ECONOMY_DEV_SEED_COINS || '100', 10),
    economyDevSeedFires: parseInt(process.env.ECONOMY_DEV_SEED_FIRES || '0', 10),
    tttTickIntervalMs: parseInt(process.env.TTT_TICK_INTERVAL_MS || '1000', 10)
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json'
  }
};

// Validate required configuration
function validateConfig() {
  const errors = [];
  
  if (!config.database.url && !config.database.host) {
    errors.push('Database configuration is missing (DATABASE_URL or PGHOST required)');
  }
  
  if (!config.telegram.botToken) {
    console.warn('⚠️ WARNING: TELEGRAM_BOT_TOKEN is not set. Telegram features will be disabled.');
  }
  
  if (!config.telegram.botUsername) {
    console.warn('⚠️ WARNING: TELEGRAM_BOT_USERNAME is not set.');
  }
  
  if (!config.security.jwtSecret || config.security.jwtSecret === 'change-this-secret-in-production') {
    if (process.env.NODE_ENV === 'production') {
      errors.push('JWT_SECRET must be set in production');
    } else {
      console.warn('⚠️ WARNING: Using default JWT_SECRET. Change this in production!');
    }
  }
  
  if (errors.length > 0) {
    console.error('❌ Configuration errors:');
    errors.forEach(error => console.error(`  - ${error}`));
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
}

// Validate on load
validateConfig();

module.exports = config;
